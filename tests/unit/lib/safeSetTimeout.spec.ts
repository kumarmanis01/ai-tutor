/**
 * FILE OBJECTIVE:
 * - Unit tests for the safeSetTimeout utility that prevents Node.js
 *   TimeoutOverflowWarning by chaining calls for durations > 2^31 - 1 ms.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/safeSetTimeout.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-05T12:30:00Z | copilot | created
 */

import { safeSetTimeout, MAX_SAFE_TIMEOUT_MS } from '@/lib/safeSetTimeout'

describe('safeSetTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('calls fn after a safe (sub-limit) delay', () => {
    const fn = jest.fn()
    safeSetTimeout(fn, 1000)

    expect(fn).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('calls fn immediately at delay = 0', () => {
    const fn = jest.fn()
    safeSetTimeout(fn, 0)
    jest.advanceTimersByTime(0)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('calls fn at exactly MAX_SAFE_TIMEOUT_MS delay', () => {
    const fn = jest.fn()
    safeSetTimeout(fn, MAX_SAFE_TIMEOUT_MS)

    jest.advanceTimersByTime(MAX_SAFE_TIMEOUT_MS - 1)
    expect(fn).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('chains to a second segment when delay exceeds MAX_SAFE_TIMEOUT_MS', () => {
    const fn = jest.fn()
    // ~30 days = 2_592_000_000 ms (the original overflowing MONTHLY_INTERVAL_MS value)
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    safeSetTimeout(fn, thirtyDaysMs)

    // After first segment, fn still not called
    jest.advanceTimersByTime(MAX_SAFE_TIMEOUT_MS)
    expect(fn).not.toHaveBeenCalled()

    // After remaining segment, fn fires
    const remaining = thirtyDaysMs - MAX_SAFE_TIMEOUT_MS
    jest.advanceTimersByTime(remaining)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not call fn before the full chained delay elapses', () => {
    const fn = jest.fn()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    safeSetTimeout(fn, thirtyDaysMs)

    jest.advanceTimersByTime(thirtyDaysMs - 1)
    expect(fn).not.toHaveBeenCalled()
  })
})
