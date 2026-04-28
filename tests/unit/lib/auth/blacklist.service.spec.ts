/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/auth/blacklist.service.ts — Redis-based JWT blacklist.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created — B2.1 blacklist service tests
 */

// ── Phase-2 TODO ──────────────────────────────────────────────────────────────
// Full integration tests require a live Redis instance. The tests below cover
// the unit-testable paths. Integration tests are tracked in post_launch_backlog.md
// under "B2.1 — Blacklist service integration tests (Redis required)".

import { blacklistToken, isBlacklisted } from '@/lib/auth/blacklist.service';

// Mock Redis
jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn(),
}));

import { getRedis } from '@/lib/redis';

const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;

describe('lib/auth/blacklist.service', () => {
  const mockRedis = {
    set: jest.fn(),
    exists: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedis.mockReturnValue(mockRedis as unknown as ReturnType<typeof getRedis>);
  });

  // ── blacklistToken ─────────────────────────────────────────────────────────

  describe('blacklistToken', () => {
    it('should call redis.set with correct key and TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const futureExp = Math.floor(Date.now() / 1000) + 3600;

      await blacklistToken('test-jti', futureExp);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'blacklist:token:test-jti',
        '1',
        'EX',
        expect.any(Number)
      );
    });

    it('should not throw when Redis is unavailable (null)', async () => {
      mockGetRedis.mockReturnValue(null);
      await expect(
        blacklistToken('jti-1', Math.floor(Date.now() / 1000) + 100)
      ).resolves.toBeUndefined();
    });

    it('should propagate Redis errors', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis down'));
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      await expect(blacklistToken('jti-2', futureExp)).rejects.toThrow('Redis down');
    });
  });

  // ── isBlacklisted ──────────────────────────────────────────────────────────

  describe('isBlacklisted', () => {
    it('should return true when token exists in Redis', async () => {
      mockRedis.exists.mockResolvedValue(1);
      const result = await isBlacklisted('revoked-jti');
      expect(result).toBe(true);
    });

    it('should return false when token is not in Redis', async () => {
      mockRedis.exists.mockResolvedValue(0);
      const result = await isBlacklisted('valid-jti');
      expect(result).toBe(false);
    });

    it('should return true (fail-safe) when Redis is unavailable', async () => {
      mockGetRedis.mockReturnValue(null);
      const result = await isBlacklisted('any-jti');
      expect(result).toBe(true);
    });

    it('should return true (fail-safe) when Redis throws', async () => {
      mockRedis.exists.mockRejectedValue(new Error('connection refused'));
      const result = await isBlacklisted('any-jti');
      expect(result).toBe(true);
    });
  });
});
