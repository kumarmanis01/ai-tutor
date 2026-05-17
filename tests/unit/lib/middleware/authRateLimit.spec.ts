/**
 * FILE OBJECTIVE:
 * - Unit tests for AUTH_RATE_LIMITS configuration in authRateLimit middleware.
 * - Covers: presence and thresholds of verifyCode operation added for OTP brute-force protection.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/middleware/authRateLimit.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-17T00:00:00Z | reviewer | created to cover verifyCode rate limit config
 */

import { AUTH_RATE_LIMITS } from '@/lib/middleware/authRateLimit';

describe('AUTH_RATE_LIMITS', () => {
  describe('verifyCode operation', () => {
    it('should be defined', () => {
      expect(AUTH_RATE_LIMITS.verifyCode).toBeDefined();
    });

    it('should allow at most 10 requests per window', () => {
      expect(AUTH_RATE_LIMITS.verifyCode.maxRequests).toBe(10);
    });

    it('should use a 15-minute window', () => {
      expect(AUTH_RATE_LIMITS.verifyCode.windowSeconds).toBe(60 * 15);
    });

    it('should block for at least 1 hour after limit exceeded', () => {
      expect(AUTH_RATE_LIMITS.verifyCode.blockDurationSeconds).toBeGreaterThanOrEqual(60 * 60);
    });
  });

  describe('sendCode operation (unchanged sanity check)', () => {
    it('should still be defined with its original thresholds', () => {
      expect(AUTH_RATE_LIMITS.sendCode.maxRequests).toBe(5);
      expect(AUTH_RATE_LIMITS.sendCode.windowSeconds).toBe(60 * 15);
    });
  });
});
