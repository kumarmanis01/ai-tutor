/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/whatsapp/cloud.service.ts — WhatsApp Cloud API service.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created — B3.1 WhatsApp service tests
 */

// ── Phase-2 TODO ──────────────────────────────────────────────────────────────
// Full send tests require a live WhatsApp Cloud API token and phone number ID.
// Those are tracked in post_launch_backlog.md under
// "B3.1 — WhatsApp Cloud API integration tests".

import { validateWebhookSignature } from '@/lib/whatsapp/cloud.service'
import * as crypto from 'crypto'

describe('lib/whatsapp/cloud.service', () => {
  const APP_SECRET = 'test-whatsapp-app-secret'

  beforeEach(() => {
    process.env.WHATSAPP_APP_SECRET = APP_SECRET
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id'
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token'
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
  })

  afterEach(() => {
    delete process.env.WHATSAPP_APP_SECRET
    delete process.env.WHATSAPP_PHONE_NUMBER_ID
    delete process.env.WHATSAPP_ACCESS_TOKEN
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  // ── validateWebhookSignature ───────────────────────────────────────────────

  describe('validateWebhookSignature', () => {
    function buildSignature(body: string, secret: string): string {
      const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex')
      return `sha256=${hmac}`
    }

    it('should return true for a valid HMAC signature', () => {
      const body = JSON.stringify({ test: 'payload' })
      const sig = buildSignature(body, APP_SECRET)
      expect(validateWebhookSignature(body, sig)).toBe(true)
    })

    it('should return false for a tampered body', () => {
      const originalBody = JSON.stringify({ test: 'payload' })
      const sig = buildSignature(originalBody, APP_SECRET)
      const tamperedBody = JSON.stringify({ test: 'tampered' })
      expect(validateWebhookSignature(tamperedBody, sig)).toBe(false)
    })

    it('should return false for wrong secret', () => {
      const body = JSON.stringify({ test: 'payload' })
      const sig = buildSignature(body, 'wrong-secret')
      expect(validateWebhookSignature(body, sig)).toBe(false)
    })

    it('should return false for missing signature header', () => {
      expect(validateWebhookSignature('body', '')).toBe(false)
    })

    it('should return false when WHATSAPP_APP_SECRET is not set', () => {
      delete process.env.WHATSAPP_APP_SECRET
      const body = 'test'
      expect(validateWebhookSignature(body, `sha256=${body}`)).toBe(false)
    })
  })

  // ── sendConsentRequest / sendOTP / sendConfirmation ────────────────────────

  // TODO Phase-2: HTTP call tests require fetch mock or MSW. Tracked in
  // post_launch_backlog.md — "B3.1 WhatsApp send* unit tests with MSW".
  describe('sendConsentRequest', () => {
    it.todo('should call WhatsApp Cloud API with correct template and parameters')
    it.todo('should retry on 5xx responses (up to 2 retries)')
    it.todo('should throw after all retries are exhausted')
  })

  describe('sendOTP', () => {
    it.todo('should send OTP via spinzy_otp template')
  })
})
