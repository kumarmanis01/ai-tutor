/**
 * FILE OBJECTIVE:
 * - Helpers for building share URLs (WhatsApp) for session summaries.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/sessionShare.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | created WhatsApp share helper
 */

/**
 * Build a WhatsApp share URL for a plain-text message. Uses wa.me shortlink
 * which works on mobile and desktop (redirects to web.whatsapp.com on desktop).
 */
export function buildWhatsAppShareUrl(message: string): string {
  const encoded = encodeURIComponent(String(message ?? ''));
  return `https://wa.me/?text=${encoded}`;
}

export default buildWhatsAppShareUrl;
