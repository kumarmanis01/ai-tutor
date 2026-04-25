/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/auth/google.service.ts — Google OAuth token verification.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created — B2.2 Google service tests
 * - 2026-04-24T00:00:00Z | copilot | use jest.resetModules to isolate _client singleton per test
 */

// ── Phase-2 TODO ──────────────────────────────────────────────────────────────
// Full end-to-end Google OAuth flow tests require a real Google ID token.
// Tracked in post_launch_backlog.md — "B2.2 Google OAuth integration tests".

// Mock dependencies (hoisted before imports)
jest.mock('@/lib/db', () => ({
  prisma: {
    user: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    account: { findFirst: jest.fn(), create: jest.fn() },
  },
}));

// Controlled mock for verifyIdToken — allows per-test configuration
const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

// ── Re-import per test group to flush _client singleton ──────────────────────

describe('lib/auth/google.service', () => {
  let verifyGoogleToken: (t: string) => Promise<unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    // Re-require after resetModules so _client is null
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- requires module reset
    verifyGoogleToken = (
      require('@/lib/auth/google.service') as typeof import('@/lib/auth/google.service')
    ).verifyGoogleToken;
  });

  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
  });

  // ── verifyGoogleToken ──────────────────────────────────────────────────────

  describe('verifyGoogleToken', () => {
    it('should return GoogleTokenPayload on valid token', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-uid-123',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/avatar.jpg',
          email_verified: true,
        }),
      });

      const result = (await verifyGoogleToken('valid-id-token')) as {
        googleId: string;
        email: string;
        name: string;
      };

      expect(result.googleId).toBe('google-uid-123');
      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
    });

    it('should throw when verifyIdToken rejects', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid audience'));
      await expect(verifyGoogleToken('bad-token')).rejects.toThrow();
    });

    it('should throw when GOOGLE_CLIENT_ID is not configured', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { verifyGoogleToken: fn } =
        require('@/lib/auth/google.service') as typeof import('@/lib/auth/google.service');
      await expect(fn('any-token')).rejects.toThrow('GOOGLE_CLIENT_ID');
    });

    it('should throw when payload is null', async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => null });
      await expect(verifyGoogleToken('token-with-null-payload')).rejects.toThrow();
    });
  });

  // ── findOrCreateUser ───────────────────────────────────────────────────────

  // TODO Phase-2: findOrCreateUser requires deeper Prisma transaction mocking.
  // Tracked in post_launch_backlog.md — "B2.2 findOrCreateUser unit tests".
  describe('findOrCreateUser', () => {
    it.todo('should return isNewUser=false for an existing linked account');
    it.todo('should return isNewUser=true and create User + Account for new users');
    it.todo('should update user name when it changes for returning user');
  });
});
