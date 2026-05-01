/**
 * FILE OBJECTIVE:
 * - Verify overflow-safe timeout scheduling for long delays in worker timer utilities.
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
 * - 2026-05-01T14:40:00Z | copilot | created tests for chunked long-delay timeout scheduling
 */

import { MAX_TIMEOUT_MS, setSafeTimeout } from '@/worker/utils/safeTimer';

describe('setSafeTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should execute callback for a normal delay', () => {
    const callback = jest.fn();

    setSafeTimeout(callback, 1_000);
    jest.advanceTimersByTime(999);
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should chunk delays larger than Node timer max and execute only after full delay', () => {
    const callback = jest.fn();
    const longDelay = MAX_TIMEOUT_MS + 5_000;

    setSafeTimeout(callback, longDelay);

    jest.advanceTimersByTime(MAX_TIMEOUT_MS);
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(4_999);
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should normalize invalid delays to zero', () => {
    const callback = jest.fn();

    setSafeTimeout(callback, Number.NaN);
    jest.runOnlyPendingTimers();

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
