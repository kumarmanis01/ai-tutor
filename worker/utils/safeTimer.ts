/**
 * FILE OBJECTIVE:
 * - Provide overflow-safe timeout scheduling for delays larger than Node's timer limit.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/utils/safeTimer.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-01T14:40:00Z | copilot | created chunked safe timeout helper for long scheduler delays
 */

export const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Schedule a callback with support for delays larger than Node's timeout cap.
 * Long delays are split into multiple MAX_TIMEOUT_MS chunks.
 */
export function setSafeTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
  const normalizedDelay = Number.isFinite(delayMs) ? Math.max(0, Math.floor(delayMs)) : 0;

  if (normalizedDelay <= MAX_TIMEOUT_MS) {
    return setTimeout(callback, normalizedDelay);
  }

  return setTimeout(() => {
    setSafeTimeout(callback, normalizedDelay - MAX_TIMEOUT_MS);
  }, MAX_TIMEOUT_MS);
}
