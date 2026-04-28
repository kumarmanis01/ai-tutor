/* eslint-disable @typescript-eslint/no-explicit-any */
import { formatINR, statusLabel } from '@/lib/currency/format';

describe('currency format helpers', () => {
  it('formats paise to INR string', () => {
    expect(formatINR(12345)).toMatch(/₹\s?123\.45|123\.45/);
    expect(formatINR(0)).toMatch(/₹\s?0\.00|0\.00/);
    expect(formatINR(null)).toMatch(/₹\s?0\.00|0\.00/);
  });

  it('maps status labels correctly', () => {
    expect(statusLabel('PAID')).toBe('Paid');
    expect(statusLabel('pending')).toBe('Pending');
    expect(statusLabel('failed')).toBe('Failed');
    expect(statusLabel('CANCELLED')).toBe('Cancelled');
    expect(statusLabel(undefined)).toBe('--');
  });
});
