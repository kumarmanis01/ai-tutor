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

const { authOptions } = require('@/lib/auth');

describe('lib/auth OAuth callbacks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.auditLog.create.mockResolvedValue({});
  });

  it('should reject Google sign in when email is not verified', async () => {
    const signIn = authOptions.callbacks.signIn;

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

  it('should create and link a new Google user when none exists', async () => {
    const signIn = authOptions.callbacks.signIn;

    prismaMock.account.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    prismaMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'user-new', email: 'student@example.com', welcomeEmailSent: true })
      .mockResolvedValueOnce({ id: 'user-new', email: 'student@example.com', board: null, grade: null });

    prismaMock.user.create.mockResolvedValue({ id: 'user-new' });

    const result = await signIn({
      user: { email: 'Student@Example.com', name: 'Student', image: 'https://img' },
      account: { provider: 'google', providerAccountId: 'sub-456', type: 'oauth' },
      profile: { email: 'Student@Example.com', email_verified: true, sub: 'sub-456' },
    });

    expect(result).toBe(true);
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'student@example.com' }),
      }),
    );
    expect(prismaMock.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-new', provider: 'google', providerAccountId: 'sub-456' }),
      }),
    );
  });

  it('should link Google account to an existing email user', async () => {
    const signIn = authOptions.callbacks.signIn;

    prismaMock.account.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    prismaMock.user.findUnique
      .mockResolvedValueOnce({ id: 'user-existing' })
      .mockResolvedValueOnce({ id: 'user-existing', email: 'existing@example.com', welcomeEmailSent: true })
      .mockResolvedValueOnce({ id: 'user-existing', email: 'existing@example.com', board: null, grade: null });

    const result = await signIn({
      user: { email: 'existing@example.com', name: 'Existing User' },
      account: { provider: 'google', providerAccountId: 'sub-789', type: 'oauth' },
      profile: { email: 'existing@example.com', email_verified: true, sub: 'sub-789' },
    });

    expect(result).toBe(true);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-existing', providerAccountId: 'sub-789' }),
      }),
    );
  });

  it('should populate token identity fields in jwt callback', async () => {
    const jwt = authOptions.callbacks.jwt;

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
    const sessionCb = authOptions.callbacks.session;

    const session = await sessionCb({
      session: { user: {} },
      token: { sub: 'sub-user-1', email: 'student@example.com', name: 'Student' },
    });

    expect(session.user.id).toBe('sub-user-1');
    expect(session.user.email).toBe('student@example.com');
  });
});
