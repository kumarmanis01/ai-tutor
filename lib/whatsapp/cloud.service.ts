/**
 * FILE OBJECTIVE:
 * - WhatsApp Cloud API v18+ service. Sends template-based messages for consent
 *   requests, OTPs, and confirmations. Validates webhook signatures (HMAC-SHA256).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/whatsapp/cloud.service.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created -- B3.1 WhatsApp Cloud API service
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { logger } from '@/lib/logger'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SendResult {
  messageId: string
  status: 'sent' | 'failed'
}

interface TemplateParam {
  type: 'text'
  text: string
}

// ── Config helpers ────────────────────────────────────────────────────────────

function getRequired(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function buildApiUrl(phoneNumberId: string, path: string): string {
  return `https://graph.facebook.com/v18.0/${phoneNumberId}${path}`
}

// ── Retry helper ──────────────────────────────────────────────────────────────

async function sendWithRetry(
  url: string,
  body: unknown,
  accessToken: string,
  maxRetries = 2,
): Promise<SendResult> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorBody = await res.text()
        throw new Error(`WhatsApp API error ${res.status}: ${errorBody}`)
      }

      const data = (await res.json()) as {
        messages?: Array<{ id: string }>
      }
      const messageId = data.messages?.[0]?.id ?? 'unknown'
      return { messageId, status: 'sent' }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
        logger.info('WhatsApp API retry', { attempt: attempt + 1, maxRetries })
      }
    }
  }

  logger.error('WhatsApp API send failed after retries', { error: lastError })
  return { messageId: '', status: 'failed' }
}

// ── Message builders ──────────────────────────────────────────────────────────

function textParam(text: string): TemplateParam {
  return { type: 'text', text }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Send a consent request message to a parent.
 * Template: `spinzy_consent_request` (must be pre-approved in Meta Business Manager)
 */
export async function sendConsentRequest(
  phone: string,
  childName: string,
  grade: string,
  board: string,
  consentToken: string,
): Promise<SendResult> {
  const phoneNumberId = getRequired('WHATSAPP_PHONE_NUMBER_ID')
  const accessToken = getRequired('WHATSAPP_ACCESS_TOKEN')
  const consentUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/consent/${consentToken}`

  const url = buildApiUrl(phoneNumberId, '/messages')
  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: 'spinzy_consent_request',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            textParam(childName),
            textParam(grade),
            textParam(board),
            textParam(consentUrl),
          ],
        },
      ],
    },
  }

  const result = await sendWithRetry(url, body, accessToken)
  logger.info('WhatsApp consent request sent', { phone, childName, ...result })
  return result
}

/**
 * Send a 6-digit OTP via WhatsApp template.
 * Template: `spinzy_otp` (must be pre-approved in Meta Business Manager)
 */
export async function sendOTP(phone: string, otp: string): Promise<SendResult> {
  const phoneNumberId = getRequired('WHATSAPP_PHONE_NUMBER_ID')
  const accessToken = getRequired('WHATSAPP_ACCESS_TOKEN')

  const url = buildApiUrl(phoneNumberId, '/messages')
  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: 'spinzy_otp',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [textParam(otp)],
        },
      ],
    },
  }

  const result = await sendWithRetry(url, body, accessToken)
  logger.info('WhatsApp OTP sent', { phone, ...result })
  return result
}

/**
 * Send a consent approval confirmation to a parent.
 * Template: `spinzy_consent_confirmation` (must be pre-approved in Meta Business Manager)
 */
export async function sendConfirmation(
  phone: string,
  childName: string,
  dashboardLink: string,
): Promise<SendResult> {
  const phoneNumberId = getRequired('WHATSAPP_PHONE_NUMBER_ID')
  const accessToken = getRequired('WHATSAPP_ACCESS_TOKEN')

  const url = buildApiUrl(phoneNumberId, '/messages')
  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: 'spinzy_consent_confirmation',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [textParam(childName), textParam(dashboardLink)],
        },
      ],
    },
  }

  const result = await sendWithRetry(url, body, accessToken)
  logger.info('WhatsApp confirmation sent', { phone, childName, ...result })
  return result
}

// ── Webhook signature validation ──────────────────────────────────────────────

/**
 * Validate the x-hub-signature-256 header sent by Meta.
 * Returns true if the signature is valid. Uses timing-safe comparison.
 */
export function validateWebhookSignature(
  rawBody: string,
  signatureHeader: string,
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) {
    logger.error('WHATSAPP_APP_SECRET not configured')
    return false
  }

  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signatureHeader, 'utf8'),
    )
  } catch {
    return false
  }
}
