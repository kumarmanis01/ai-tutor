/**
 * FILE OBJECTIVE:
 * - Unit tests for ADMIN_ALLOWED_IPS CIDR whitelist helper.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:20:00Z | copilot | created tests for admin IP whitelist helper
 */

import { isAllowedAdminIp } from '@/lib/admin/ipWhitelist';

describe('lib/admin/ipWhitelist', () => {
  const originalAllowedIps = process.env.ADMIN_ALLOWED_IPS;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.ADMIN_ALLOWED_IPS = originalAllowedIps;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('allows all when ADMIN_ALLOWED_IPS is empty', () => {
    process.env.ADMIN_ALLOWED_IPS = '';
    expect(isAllowedAdminIp('8.8.8.8')).toBe(true);
  });

  it('allows IPs in configured CIDRs', () => {
    process.env.ADMIN_ALLOWED_IPS = '10.0.0.0/8,192.168.1.0/24';
    expect(isAllowedAdminIp('10.12.2.9')).toBe(true);
    expect(isAllowedAdminIp('192.168.1.55')).toBe(true);
    expect(isAllowedAdminIp('172.16.1.1')).toBe(false);
  });

  it('allows localhost in non-production', () => {
    process.env.ADMIN_ALLOWED_IPS = '10.0.0.0/8';
    process.env.NODE_ENV = 'development';
    expect(isAllowedAdminIp('127.0.0.1')).toBe(true);
  });
});
