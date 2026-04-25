import { isSystemSettingEnabled } from '@/lib/systemSettings';

describe('isSystemSettingEnabled', () => {
  test('handles booleans and string true', () => {
    expect(isSystemSettingEnabled(true)).toBe(true);
    expect(isSystemSettingEnabled('true')).toBe(true);
    expect(isSystemSettingEnabled(false)).toBe(false);
    expect(isSystemSettingEnabled('false')).toBe(false);
  });

  test('handles objects with enabled property', () => {
    expect(isSystemSettingEnabled({ enabled: true })).toBe(true);
    expect(isSystemSettingEnabled({ enabled: 'true' })).toBe(true);
    expect(isSystemSettingEnabled({ enabled: false })).toBe(false);
  });

  test('returns false for other values', () => {
    expect(isSystemSettingEnabled(null)).toBe(false);
    expect(isSystemSettingEnabled(123)).toBe(false);
    expect(isSystemSettingEnabled({})).toBe(false);
  });
});
