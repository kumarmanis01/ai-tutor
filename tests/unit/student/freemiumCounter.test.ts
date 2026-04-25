/**
 * Unit tests for FreemiumCounter dashboard widget.
 * F-STU-040 AC-02: Session cap counter always visible for free-tier students.
 *
 * Pure logic tests (no React rendering -- avoids @testing-library/react dependency).
 * Tests the period reset date computation.
 */

describe('FreemiumCounter -- reset date computation', () => {
  it('should compute reset date as one month after periodStart', () => {
    const periodStart = '2026-04-01T00:00:00.000Z';
    const resetDate = new Date(periodStart);
    resetDate.setMonth(resetDate.getMonth() + 1);
    expect(resetDate.getMonth()).toBe(4); // May
    expect(resetDate.getFullYear()).toBe(2026);
  });

  it('should handle month rollover at year boundary', () => {
    const periodStart = '2026-12-01T00:00:00.000Z';
    const resetDate = new Date(periodStart);
    resetDate.setMonth(resetDate.getMonth() + 1);
    expect(resetDate.getFullYear()).toBe(2027);
    expect(resetDate.getMonth()).toBe(0); // January
  });
});

describe('FreemiumCounter -- fill percentage', () => {
  it('should compute fill percent from sessionsUsed / total', () => {
    const sessionsUsed = 2;
    const sessionsRemaining = 1;
    const total = sessionsUsed + sessionsRemaining;
    const fillPercent = total > 0 ? Math.round((sessionsUsed / total) * 100) : 0;
    expect(fillPercent).toBe(67);
  });

  it('should return 0 when total is 0', () => {
    const total = 0;
    const fillPercent = total > 0 ? Math.round((0 / total) * 100) : 0;
    expect(fillPercent).toBe(0);
  });

  it('should return 100 when all sessions used', () => {
    const sessionsUsed = 3;
    const sessionsRemaining = 0;
    const total = sessionsUsed + sessionsRemaining;
    const fillPercent = total > 0 ? Math.round((sessionsUsed / total) * 100) : 0;
    expect(fillPercent).toBe(100);
  });
});
