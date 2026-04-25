/**
 * Unit tests: grade immutability in POST /api/user/onboarding
 *
 * grade is immutable after first save — never accept from client
 */

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    logAPI: jest.fn(),
  },
}));
jest.mock('@/lib/errorResponse', () => ({ formatErrorForResponse: (e: unknown) => String(e) }));
jest.mock('@/lib/dailyHabit', () => ({ getDailyTask: jest.fn().mockResolvedValue(null) }));
jest.mock('@/jobs/diagnosticBootstrap', () => ({
  enqueueDiagnosticBootstrapJob: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    subjectDef: { findMany: jest.fn() },
    classLevel: { findFirst: jest.fn() },
    event: { create: jest.fn() },
  },
}));

import { NextRequest } from 'next/server';
import { POST } from '../../../app/api/user/onboarding/route';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';

const mockSession = getServerSessionForHandlers as jest.Mock;
const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockUpdate = prisma.user.update as jest.Mock;
const mockSubjectDef = prisma.subjectDef.findMany as jest.Mock;

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/user/onboarding', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const BASE_BODY = {
  name: 'Test Student',
  age: 16,
  class_grade: '10',
  board: 'CBSE',
  preferred_language: 'en',
  subjects: ['math'],
  parent_email: 'parent@example.com',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.mockResolvedValue({ user: { id: 'user-1' } });
  // subjects validation passes
  mockSubjectDef.mockResolvedValue([{ name: 'math', slug: 'math' }]);
  (prisma.classLevel.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.event.create as jest.Mock).mockResolvedValue({});
});

describe('POST /api/user/onboarding — grade immutability', () => {
  test('first-time onboarding (grade is null) → grade is written to DB', async () => {
    const existingUser = { id: 'user-1', grade: null, phone: null, name: null };
    mockFindUnique.mockResolvedValue(existingUser);
    mockUpdate.mockResolvedValue({ id: 'user-1', name: 'Test Student', phone: null });

    const res = await POST(makeReq({ ...BASE_BODY, class_grade: '10' }));
    expect(res.status).toBe(200);

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data.grade).toBe('10');
  });

  test('re-onboarding (grade already set) → grade is stripped, DB value unchanged', async () => {
    const existingUser = { id: 'user-1', grade: '10', phone: null, name: 'Test Student' };
    mockFindUnique.mockResolvedValue(existingUser);
    mockUpdate.mockResolvedValue({ id: 'user-1', name: 'Test Student', phone: null });

    const res = await POST(makeReq({ ...BASE_BODY, class_grade: '9' }));
    expect(res.status).toBe(200);

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('grade');
  });

  test('re-onboarding with same grade → grade is still stripped (immutable)', async () => {
    const existingUser = { id: 'user-1', grade: '10', phone: null, name: 'Test Student' };
    mockFindUnique.mockResolvedValue(existingUser);
    mockUpdate.mockResolvedValue({ id: 'user-1', name: 'Test Student', phone: null });

    const res = await POST(makeReq({ ...BASE_BODY, class_grade: '10' }));
    expect(res.status).toBe(200);

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('grade');
  });

  test('re-onboarding resolved by email fallback → grade stripped when resolved user has grade', async () => {
    // existingById returns null (session ID mismatch), resolved via email
    const resolvedUser = { id: 'user-resolved', grade: '10', phone: null, name: 'Test Student' };
    mockFindUnique
      .mockResolvedValueOnce(null) // existingById: not found by session ID
      .mockResolvedValueOnce(resolvedUser) // byEmail: found
      .mockResolvedValueOnce(resolvedUser); // grade check: findUnique by resolved userId
    mockSession.mockResolvedValue({ user: { id: 'user-1', email: 'test@example.com' } });
    mockUpdate.mockResolvedValue({ id: 'user-resolved', name: 'Test Student', phone: null });

    const res = await POST(makeReq({ ...BASE_BODY, class_grade: '9' }));
    expect(res.status).toBe(200);

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('grade');
  });
});
