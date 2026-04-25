import { isCapReached, REVISION_DAILY_CAP_MINUTES } from '@/lib/student/revisionCap';

describe('revisionCap', () => {
  test('isCapReached returns false when minutes are below the daily cap', () => {
    const below = REVISION_DAILY_CAP_MINUTES - 1;
    expect(isCapReached(below)).toBe(false);
  });

  test('isCapReached returns true when minutes equal or exceed the daily cap', () => {
    expect(isCapReached(REVISION_DAILY_CAP_MINUTES)).toBe(true);
    expect(isCapReached(REVISION_DAILY_CAP_MINUTES + 5)).toBe(true);
  });
});
