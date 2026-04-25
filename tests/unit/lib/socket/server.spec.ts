/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/socket/server.ts and lib/socket/event-bus.ts —
 *   Socket.IO typed event emitters and room name helpers.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created — B5.1 Socket.IO tests
 * - 2026-04-24T00:00:00Z | copilot | mock socket.io + jose deps to avoid ESM issues
 */

// ── Mock heavy deps before any import ────────────────────────────────────────
// socket.io is CJS but imports jose transitively via token.service.
// Mock both to isolate pure logic tests.

jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => ({
    use: jest.fn(),
    on: jest.fn(),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  })),
}));

jest.mock('@/lib/auth/token.service', () => ({
  verifyUserAccessToken: jest.fn(),
}));

jest.mock('@/lib/auth/blacklist.service', () => ({
  isBlacklisted: jest.fn().mockResolvedValue(false),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { rooms } from '@/lib/socket/event-bus';

// ── event-bus room helpers ────────────────────────────────────────────────────

describe('lib/socket/event-bus — rooms helpers', () => {
  describe('rooms.user', () => {
    it('should return "user:{userId}" room name', () => {
      expect(rooms.user('abc-123')).toBe('user:abc-123');
    });
  });

  describe('rooms.student', () => {
    it('should return "student:{profileId}" room name', () => {
      expect(rooms.student('profile-456')).toBe('student:profile-456');
    });
  });

  describe('rooms.consent', () => {
    it('should return "consent:{token}" room name', () => {
      expect(rooms.consent('tok_xyz')).toBe('consent:tok_xyz');
    });
  });
});

// ── lib/socket/server.ts — emit helpers (uninitialized io = null) ─────────────

describe('lib/socket/server — emit helpers (io not initialized)', () => {
  // Reset module registry so _io singleton is null for each test group
  let serverModule: typeof import('@/lib/socket/server');

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolateModules pattern
    serverModule = require('@/lib/socket/server') as typeof import('@/lib/socket/server');
  });

  it('getIO should return null before initialization', () => {
    expect(serverModule.getIO()).toBeNull();
  });

  it('emitConsentApproved should not throw when io is null', () => {
    expect(() => serverModule.emitConsentApproved('tok', 'student-1')).not.toThrow();
  });

  it('emitConsentDenied should not throw when io is null', () => {
    expect(() => serverModule.emitConsentDenied('tok', 'student-1')).not.toThrow();
  });

  it('emitConsentExpired should not throw when io is null', () => {
    expect(() => serverModule.emitConsentExpired('tok', 'student-1')).not.toThrow();
  });

  it('emitPremiumActivated should not throw when io is null', () => {
    expect(() =>
      serverModule.emitPremiumActivated('student-1', 'monthly', new Date().toISOString())
    ).not.toThrow();
  });

  it('emitContentGenerated should not throw when io is null', () => {
    expect(() =>
      serverModule.emitContentGenerated('student-1', 'content-id', 'Algebra')
    ).not.toThrow();
  });

  it('emitNewBadge should not throw when io is null', () => {
    expect(() => serverModule.emitNewBadge('user-1', 'badge-1', 'Scholar', '🎓')).not.toThrow();
  });

  it('emitAssignmentReceived should not throw when io is null', () => {
    expect(() =>
      serverModule.emitAssignmentReceived('student-1', { assignmentId: 'a-1', title: 'Ch3 Quiz' })
    ).not.toThrow();
  });

  it('emitAssignmentCompleted should not throw when io is null', () => {
    expect(() =>
      serverModule.emitAssignmentCompleted('parent-1', {
        assignmentId: 'a-1',
        childName: 'Ananya',
        score: 90,
      })
    ).not.toThrow();
  });

  // TODO Phase-2: Full initSocketIO tests with mock HTTP server + JWT.
  // Tracked in post_launch_backlog.md — "B5.1 Socket.IO full server tests".
  it.todo('initSocketIO should attach to HTTP server and return io instance');
  it.todo('should reject connections with missing JWT');
  it.todo('should reject connections with expired JWT');
  it.todo('should auto-join user:{userId} room on connect');
  it.todo('join_consent_room should add socket to consent:{token} room');
});
