/**
 * FILE OBJECTIVE:
 * - Unit tests for app/api/v1/webhooks/whatsapp/route.ts —
 *   WhatsApp webhook GET (hub challenge) and POST (message processing).
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created — B3.1 webhook route tests
 */

// ── Phase-2 TODO ──────────────────────────────────────────────────────────────
// Full message-processing tests require Prisma mock + HMAC sig helpers.
// Tracked in post_launch_backlog.md — "B3.1 WhatsApp webhook integration tests".

jest.mock('@/lib/whatsapp/cloud.service', () => ({
  validateWebhookSignature: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    consentRequest: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    consentMessageLog: {
      updateMany: jest.fn(),
    },
  },
}))

import { GET, POST } from '@/app/api/v1/webhooks/whatsapp/route'
import { validateWebhookSignature } from '@/lib/whatsapp/cloud.service'
import { NextRequest } from 'next/server'

const mockValidateSig = validateWebhookSignature as jest.MockedFunction<typeof validateWebhookSignature>

function buildGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/v1/webhooks/whatsapp')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

function buildPostRequest(body: unknown, sig = 'sha256=valid'): NextRequest {
  return new NextRequest('http://localhost/api/v1/webhooks/whatsapp', {
    method: 'POST',
    headers: { 'x-hub-signature-256': sig, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/v1/webhooks/whatsapp', () => {
  beforeEach(() => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test-verify-token'
  })
  afterEach(() => {
    delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  })

  it('should return challenge when mode=subscribe and token matches', async () => {
    const req = buildGetRequest({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'test-verify-token',
      'hub.challenge': 'challenge-string-123',
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe('challenge-string-123')
  })

  it('should return 403 when verify token does not match', async () => {
    const req = buildGetRequest({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'challenge-123',
    })
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('should return 403 when mode is not subscribe', async () => {
    const req = buildGetRequest({
      'hub.mode': 'unsubscribe',
      'hub.verify_token': 'test-verify-token',
      'hub.challenge': 'challenge-123',
    })
    const res = await GET(req)
    expect(res.status).toBe(403)
  })
})

describe('POST /api/v1/webhooks/whatsapp', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.WHATSAPP_APP_SECRET = 'test-secret'
  })
  afterEach(() => {
    delete process.env.WHATSAPP_APP_SECRET
  })

  it('should return 200 even on invalid signature (webhook spec)', async () => {
    mockValidateSig.mockReturnValue(false)
    const req = buildPostRequest({ entry: [] }, 'sha256=bad')
    const res = await POST(req)
    // WhatsApp spec: always return 200 to prevent retries
    expect(res.status).toBe(200)
  })

  it('should return 200 for valid empty webhook payload', async () => {
    mockValidateSig.mockReturnValue(true)
    const req = buildPostRequest({
      object: 'whatsapp_business_account',
      entry: [],
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  // TODO Phase-2: Test YES/NO reply parsing and ConsentRequest status updates.
  // Tracked in post_launch_backlog.md — "B3.1 WhatsApp reply parsing tests".
  it.todo('should update ConsentRequest to APPROVED on YES reply')
  it.todo('should update ConsentRequest to DENIED on NO/nahi reply')
  it.todo('should handle delivery status updates')
  it.todo('should handle read status updates')
})
