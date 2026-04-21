/**
 * lib/whatsapp/sender.ts
 * WhatsApp Business API sender -- Meta Cloud API (graph.facebook.com)
 *
 * Supports:
 *   - Template messages (pre-approved by Meta) for outbound system nudges
 *   - Text messages for admin custom sends (within 24h session window)
 *
 * Retry: up to 2 retries with exponential backoff (1s, 2s).
 * Rate: callers must enforce per-user limits (see lib/notifications/policy.ts).
 * Never throws -- returns { ok, messageId?, error? }.
 *
 * Required env vars:
 *   WHATSAPP_API_URL       https://graph.facebook.com/v18.0
 *   WHATSAPP_API_TOKEN     Permanent system user token from Meta Developer console
 *   WHATSAPP_PHONE_ID      Phone number ID (not the phone number itself)
 *   WHATSAPP_ENABLED       "1" to enable; anything else disables
 */

import { logger } from '@/lib/logger'

// ── Config ────────────────────────────────────────────────────────────────────

const API_URL   = process.env.WHATSAPP_API_URL ?? 'https://graph.facebook.com/v18.0'
const TOKEN     = process.env.WHATSAPP_API_TOKEN ?? ''
const PHONE_ID  = process.env.WHATSAPP_PHONE_ID ?? ''
const ENABLED   = process.env.WHATSAPP_ENABLED === '1'

const MAX_RETRIES = 2
const BASE_DELAY_MS = 1000

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WaSendResult {
  ok: boolean
  messageId?: string
  error?: string
}

export interface WaTemplateComponent {
  type: 'header' | 'body' | 'button'
  parameters: Array<{ type: 'text'; text: string } | { type: 'currency'; currency_code: string; fallback_value: string; amount_1000: number } | { type: 'date_time'; fallback_value: string }>
  sub_type?: 'url' | 'quick_reply'
  index?: number
}

export interface WaTemplateMessage {
  name: string
  language: string
  components?: WaTemplateComponent[]
}

// ── Normalisation ─────────────────────────────────────────────────────────────

export function normalizePhone(phone: string): string {
  let n = phone.replace(/[\s\-().+]/g, '')
  if (n.startsWith('0')) n = '91' + n.slice(1)
  if (/^\d{10}$/.test(n)) n = '91' + n
  return n
}

// ── Core send ─────────────────────────────────────────────────────────────────

async function postToMeta(payload: Record<string, unknown>): Promise<WaSendResult> {
  if (!TOKEN || !PHONE_ID) {
    return { ok: false, error: 'WhatsApp not configured (missing token or phone ID)' }
  }

  const url = `${API_URL}/${PHONE_ID}/messages`
  let lastError = ''

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, BASE_DELAY_MS * attempt))
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      })

      if (res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, unknown>
        const msgs = data.messages as Array<{ id: string }> | undefined
        return { ok: true, messageId: msgs?.[0]?.id }
      }

      const body = await res.text().catch(() => '')
      lastError = `HTTP ${res.status}: ${body.slice(0, 200)}`

      // 4xx errors (bad request, auth) -- do not retry
      if (res.status >= 400 && res.status < 500) break
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  return { ok: false, error: lastError }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send a pre-approved WhatsApp template message.
 * Use for all outbound system nudges (inactivity, digest, milestones, trial).
 */
export async function sendWhatsAppTemplate(
  phone: string,
  template: WaTemplateMessage,
): Promise<WaSendResult> {
  if (!ENABLED) {
    logger.info('[wa/sender] disabled', { phone: phone.slice(-4) })
    return { ok: false, error: 'WhatsApp disabled' }
  }

  const normalized = normalizePhone(phone)
  const payload = {
    messaging_product: 'whatsapp',
    to: normalized,
    type: 'template',
    template: {
      name: template.name,
      language: { code: template.language },
      ...(template.components?.length ? { components: template.components } : {}),
    },
  }

  const result = await postToMeta(payload)
  logger.info('[wa/sender] template', { ok: result.ok, template: template.name, phone: normalized.slice(-4), error: result.error })
  return result
}

/**
 * Send a free-form text message.
 * Valid only within the 24-hour customer service window after the user last messaged us.
 * Used by admin for custom one-off messages.
 */
export async function sendWhatsAppText(
  phone: string,
  message: string,
): Promise<WaSendResult> {
  if (!ENABLED) {
    logger.info('[wa/sender] disabled', { phone: phone.slice(-4) })
    return { ok: false, error: 'WhatsApp disabled' }
  }

  const normalized = normalizePhone(phone)
  const payload = {
    messaging_product: 'whatsapp',
    to: normalized,
    type: 'text',
    text: { body: message.slice(0, 4096) },
  }

  const result = await postToMeta(payload)
  logger.info('[wa/sender] text', { ok: result.ok, phone: normalized.slice(-4), error: result.error })
  return result
}

/**
 * Fire-and-forget wrapper. Never throws.
 */
export async function sendWhatsAppSafe(
  phone: string,
  message: string,
): Promise<void> {
  try {
    await sendWhatsAppText(phone, message)
  } catch (err) {
    logger.error('[wa/sender] sendWhatsAppSafe suppressed', { error: String(err) })
  }
}
