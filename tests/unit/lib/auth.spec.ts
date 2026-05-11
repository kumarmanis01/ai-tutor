/* eslint-disable @typescript-eslint/no-require-imports -- require is needed to avoid jest mock hoisting TDZ in this file */

/**
 * FILE OBJECTIVE:
 * - Validate NextAuth callback behavior in lib/auth.ts for Google OAuth verification,
 *   account linking, and session/JWT identity propagation.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/auth.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add coverage for absent profile and string email_verified branches; align assertions
 *     with current signIn callback (adapter ops happen outside the callback, not inside)
 * - 2026-05-08T00:00:00Z | copilot | assert Google provider enforces account chooser prompt via authorization params
 * - 2026-05-07T00:00:00Z | copilot | add coverage for Google sub/email_verified sign-in flow and session id propagation
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const prismaMock: any = {
  user: {
    upsert: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  account: {
    findFirst: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  auditLog: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock('@next-auth/prisma-adapter', () => ({
  PrismaAdapter: jest.fn(() => ({})),
}));

jest.mock('next-auth/providers/google', () => ({
  __esModule: true,
  default: jest.fn((config: Record<string, unknown> = {}) => ({ id: 'google', ...config })),
}));

jest.mock('next-auth/providers/email', () => ({
  __esModule: true,
  default: jest.fn((config: Record<string, unknown> = {}) => ({ id: 'email', ...config })),
}));

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

jest.mock('@/lib/mailer', () => ({ sendMail: jest.fn(async () => undefined) }));
jest.mock('@/lib/email/templates', () => ({
  welcomeEmailHtml: jest.fn(() => '<html>welcome</html>'),
  magicLinkHtml: jest.fn(() => '<html>magic-link</html>'),
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    add: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

function loadAuthOptions() {
  return require('@/lib/auth').authOptions;
}

describe('lib/auth OAuth callbacks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.auditLog.create.mockResolvedValue({});
  });

  it('should configure Google provider to always show the account chooser', () => {
    jest.resetModules();

    const googleProviderMock = require('next-auth/providers/google').default;
    loadAuthOptions();

    expect(googleProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        authorization: {
          params: {
            prompt: 'select_account',
          },
        },
      }),
    );
  });

  it('should reject Google sign in when email is not verified', async () => {
    const signIn = loadAuthOptions().callbacks.signIn;

    const result = await signIn({
      user: { email: 'student@example.com', name: 'Student' },
      account: { provider: 'google', providerAccountId: 'sub-123', type: 'oauth' },
      profile: { email: 'student@example.com', email_verified: false, sub: 'sub-123' },
    });

    expect(result).toBe(false);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.user.upsert).not.toHaveBeenCalled();
    expect(prismaMock.account.create).not.toHaveBeenCalled();
  });

  it('should allow Google sign-in with valid verified profile', async () => {
    // adapter createUser/linkAccount ops happen before the callback -- signIn callback
    // only validates claims, sends welcome email, and records the audit log.
    const signIn = loadAuthOptions().callbacks.signIn;

    prismaMock.user.findUnique
      .mockResolvedValueOnce({ id: 'user-new', email: 'student@example.com', welcomeEmailSent: true })
      .mockResolvedValueOnce({ id: 'user-new', email: 'student@example.com', board: null, grade: null });

    const result = await signIn({
      user: { email: 'Student@Example.com', name: 'Student', image: 'https://img' },
      account: { provider: 'google', providerAccountId: 'sub-456', type: 'oauth' },
      profile: { email: 'Student@Example.com', email_verified: true, sub: 'sub-456' },
    });

    expect(result).toBe(true);
    // Adapter upsert methods are NOT invoked from within the signIn callback itself.
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.account.create).not.toHaveBeenCalled();
  });

  it('should allow Google sign-in when profile is absent (NextAuth edge case)', async () => {
    // When NextAuth cannot decode the ID token, profile is undefined.
    // PKCE+state already validated the identity, so we allow through on subject + email.
    const signIn = loadAuthOptions().callbacks.signIn;

    prismaMock.user.findUnique
      .mockResolvedValueOnce({ id: 'user-1', email: 'student@example.com', welcomeEmailSent: true })
      .mockResolvedValueOnce({ id: 'user-1', email: 'student@example.com', board: null, grade: null });

    const result = await signIn({
      user: { email: 'student@example.com', name: 'Student' },
      account: { provider: 'google', providerAccountId: 'sub-xyz', type: 'oauth' },
      profile: undefined,
    });

    expect(result).toBe(true);
  });

  it('should allow Google sign-in when email_verified is string "true"', async () => {
    const signIn = loadAuthOptions().callbacks.signIn;

    prismaMock.user.findUnique
      .mockResolvedValueOnce({ id: 'user-2', email: 'student@example.com', welcomeEmailSent: true })
      .mockResolvedValueOnce({ id: 'user-2', email: 'student@example.com', board: null, grade: null });

    const result = await signIn({
      user: { email: 'student@example.com', name: 'Student' },
      account: { provider: 'google', providerAccountId: 'sub-abc', type: 'oauth' },
      profile: { email: 'student@example.com', email_verified: 'true', sub: 'sub-abc' },
    });

    expect(result).toBe(true);
  });

  it('should reject Google sign-in when profile is present but email is missing', async () => {
    const signIn = loadAuthOptions().callbacks.signIn;

    const result = await signIn({
      user: { email: undefined, name: 'NoEmail' },
      account: { provider: 'google', providerAccountId: 'sub-nomail', type: 'oauth' },
      profile: { email: undefined, email_verified: true, sub: 'sub-nomail' },
    });

    expect(result).toBe(false);
  });

  it('should populate token identity fields in jwt callback', async () => {
    const jwt = loadAuthOptions().callbacks.jwt;

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'db-user-1',
      role: 'student',
      grade: '10',
      board: 'cbse',
      language: 'en',
      subjects: ['math'],
      accountStatus: 'active',
    });

    const token = await jwt({ token: { email: 'student@example.com' }, user: undefined });

    expect(token.id).toBe('db-user-1');
    expect(token.role).toBe('student');
    expect(token.onboardingComplete).toBe(true);
    expect(token.accountStatus).toBe('active');
  });

  it('should expose session.user.id from token fields', async () => {
    const sessionCb = loadAuthOptions().callbacks.session;

    const session = await sessionCb({
      session: { user: {} },
      token: { sub: 'sub-user-1', email: 'student@example.com', name: 'Student' },
    });

    expect(session.user.id).toBe('sub-user-1');
    expect(session.user.email).toBe('student@example.com');
  });
});
