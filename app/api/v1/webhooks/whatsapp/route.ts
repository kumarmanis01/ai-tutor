/**
 * FILE OBJECTIVE:
 * - WhatsApp Cloud API webhook handler.
 *   GET  -- webhook verification (hub.challenge handshake).
 *   POST -- incoming message handler: validates HMAC signature, processes
 *           YES/NO consent replies, and updates ConsentMessageLog delivery status.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/webhooks/whatsapp/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created -- B3.1 WhatsApp webhook route
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateWebhookSignature, sendConfirmation } from '@/lib/whatsapp/cloud.service'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { AccountStatus } from '@prisma/client'

// ── Regex patterns ────────────────────────────────────────────────────────────
// P1.4-R: support Hindi affirmative replies (haan, ji, ok) in addition to YES
const YES_PATTERN = /\b(yes|haan|ji|ok)\b/i
// P1.6-R: support Hindi denial (nahi, nahi chahiye)
const NO_PATTERN = /\b(no|nahi|nahi\s+chahiye)\b/i

// ── GET -- webhook verification ────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  if (!verifyToken) {
    logger.error('WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// ── POST -- incoming messages ──────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Read raw body for HMAC verification
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256') ?? ''

  if (!validateWebhookSignature(rawBody, signature)) {
    // Per webhook guidance, do not return an error status for signature
    // verification failures to avoid client retries from Meta. Log and
    // return 200 without processing.
    logger.warn('WhatsApp webhook signature validation failed -- skipping processing', { signature })
    return NextResponse.json({ ok: true })
  }

  let payload: WhatsAppWebhookPayload
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Process each entry
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      if (!value) continue

      // Handle incoming messages
      for (const message of value.messages ?? []) {
        await handleIncomingMessage(message, value.metadata?.phone_number_id).catch(
          (err: unknown) => logger.error('Error handling WhatsApp message', { error: err }),
        )
      }

      // Handle delivery/read status updates
      for (const status of value.statuses ?? []) {
        await handleStatusUpdate(status).catch(
          (err: unknown) => logger.error('Error handling WhatsApp status', { error: err }),
        )
      }
    }
  }

  // Always return 200 to Meta so it doesn't retry
  return NextResponse.json({ ok: true })
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleIncomingMessage(
  message: WhatsAppMessage,
  _phoneNumberId?: string,
): Promise<void> {
  const replyText = message.text?.body?.trim() ?? ''
  const senderPhone = message.from

  if (!replyText || !senderPhone) return

  // Find open consent request for this phone
  const consentRequest = await prisma.consentRequest.findFirst({
    where: {
      parentPhone: senderPhone,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!consentRequest) {
    logger.info('WhatsApp reply with no matching consent request', { senderPhone })
    return
  }

  if (YES_PATTERN.test(replyText)) {
    // Approve consent and activate student account atomically
    await prisma.$transaction([
      prisma.consentRequest.update({
        where: { id: consentRequest.id },
        data: { status: 'APPROVED' },
      }),
      prisma.user.update({
        where: { id: consentRequest.studentId },
        data: { accountStatus: AccountStatus.active },
      }),
    ])
    logger.info('Consent approved via WhatsApp', { consentRequestId: consentRequest.id })
    // P1.4-R: reply to parent with confirmation + dashboard link
    try {
      const student = await prisma.user.findUnique({
        where: { id: consentRequest.studentId },
        select: { name: true },
      })
      const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://spinzyacademy.com'}/parent/dashboard`
      await sendConfirmation(senderPhone, student?.name ?? 'your child', dashboardUrl)
    } catch (confirmErr) {
      logger.warn('WhatsApp: confirmation send failed', {
        error: confirmErr instanceof Error ? confirmErr.message : String(confirmErr),
      })
    }
  } else if (NO_PATTERN.test(replyText)) {
    await prisma.consentRequest.update({
      where: { id: consentRequest.id },
      data: { status: 'DENIED' },
    })
    logger.info('Consent denied via WhatsApp', { consentRequestId: consentRequest.id })
  }
}

async function handleStatusUpdate(status: WhatsAppStatus): Promise<void> {
  const { id: messageId, status: deliveryStatus } = status

  if (!messageId) return

  const log = await prisma.consentMessageLog.findFirst({
    where: { messageId },
  })

  if (!log) return

  const updateData: Record<string, unknown> = {}
  if (deliveryStatus === 'delivered') {
    updateData.status = 'DELIVERED'
    updateData.deliveredAt = new Date()
  } else if (deliveryStatus === 'read') {
    updateData.status = 'READ'
    updateData.readAt = new Date()
  } else if (deliveryStatus === 'failed') {
    updateData.status = 'FAILED'
    updateData.failedAt = new Date()
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.consentMessageLog.update({
      where: { id: log.id },
      data: updateData,
    })
  }
}

// ── Webhook payload types ─────────────────────────────────────────────────────

interface WhatsAppWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: WhatsAppChangeValue
    }>
  }>
}

interface WhatsAppChangeValue {
  metadata?: { phone_number_id?: string }
  messages?: WhatsAppMessage[]
  statuses?: WhatsAppStatus[]
}

interface WhatsAppMessage {
  from?: string
  id?: string
  type?: string
  text?: { body?: string }
}

interface WhatsAppStatus {
  id?: string
  status?: 'sent' | 'delivered' | 'read' | 'failed'
  recipient_id?: string
}
