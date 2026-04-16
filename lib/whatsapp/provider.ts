/**
 * FILE OBJECTIVE:
 * - Provider adapter for sending WhatsApp messages (mock implementation).
 * - Real providers (Gupshup/Twilio) can implement the same interface and be
 *   selected via `WHATSAPP_PROVIDER` env var.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/whatsapp/provider.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot-planner | added mock whatsapp provider adapter
 * - 2026-04-15T12:00:00Z | copilot | replace anonymous default export with named const
 */

import { logger } from '@/lib/logger'

export async function sendTemplate(to: string, templateKey: string, params: Record<string, string | number | null>) {
  // Mock implementation: log and resolve. Production implementation should
  // call provider API and handle rate-limiting, retries, templates, and errors.
  logger.info('[whatsapp:provider] sendTemplate', { to, templateKey, params })
  return { ok: true }
}

const WhatsappProvider = { sendTemplate }

export default WhatsappProvider
