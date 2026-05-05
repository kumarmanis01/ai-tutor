/**
 * FILE OBJECTIVE:
 * - Provide safeSetTimeout / safeSetInterval wrappers that chain calls for durations
 *   exceeding Node.js's 32-bit signed integer setTimeout limit, preventing
 *   TimeoutOverflowWarning and the resulting clamping to 1 ms.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/safeSetTimeout.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-05T12:30:00Z | copilot | created -- fix TimeoutOverflowWarning for durations > 24.8 days
 */

/**
 * Maximum value Node.js setTimeout safely accepts (2^31 − 1 ms ≈ 24.8 days).
 * Values above this overflow a 32-bit signed integer and get clamped to 1 ms.
 */
export const MAX_SAFE_TIMEOUT_MS = 2_147_483_647

/**
 * Drop-in replacement for setTimeout that handles durations exceeding Node.js's
 * 32-bit signed integer limit by chaining recursive calls.
 *
 * @param fn - Callback to invoke after the delay
 * @param ms - Desired delay in milliseconds (may exceed 2^31 − 1)
 * @returns A NodeJS.Timeout handle. Clearing it cancels only the current segment;
 *          use the returned ref object from safeSetTimeoutRef if you need a
 *          cancellable multi-segment timer.
 */
export function safeSetTimeout(fn: () => void, ms: number): NodeJS.Timeout {
  if (ms <= MAX_SAFE_TIMEOUT_MS) {
    return setTimeout(fn, ms)
  }
  // Schedule in MAX_SAFE_TIMEOUT_MS chunks, then recurse with the remainder.
  return setTimeout(() => {
    safeSetTimeout(fn, ms - MAX_SAFE_TIMEOUT_MS)
  }, MAX_SAFE_TIMEOUT_MS)
}
