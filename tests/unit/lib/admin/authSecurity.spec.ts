/**
 * FILE OBJECTIVE:
 * - Unit tests for admin auth security helper utilities.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created authSecurity helper tests
 */

import {
  buildOtpAuthUri,
  generateBackupCodes,
  generateMfaSecret,
  isCorporateEmail,
  validateAdminPassword,
  verifyTotp,
} from '@/lib/admin/authSecurity';

describe('lib/admin/authSecurity', () => {
  it('should block free email domains', () => {
    expect(isCorporateEmail('admin@gmail.com')).toBe(false);
    expect(isCorporateEmail('admin@company.com')).toBe(true);
  });

  it('should validate strong password rules', () => {
    expect(validateAdminPassword('weak')).toEqual(
      expect.objectContaining({ valid: false })
    );
    expect(validateAdminPassword('StrongPass#123')).toEqual(
      expect.objectContaining({ valid: true })
    );
  });

  it('should generate setup artifacts for TOTP', () => {
    const secret = generateMfaSecret();
    const uri = buildOtpAuthUri('admin@company.com', secret);
    expect(uri.startsWith('otpauth://totp/')).toBe(true);

    const sampleCodeLooksValidLength = verifyTotp(secret, '000000', 0);
    expect(typeof sampleCodeLooksValidLength).toBe('boolean');
  });

  it('should generate uppercase backup codes', () => {
    const codes = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    expect(codes[0]).toMatch(/^[A-F0-9]{8}$/);
  });
});
