/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/v1/students/{id}/diagnostic-result authorization checks.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/students/[id]/diagnostic-result/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T13:45:00Z | copilot | add auth tests for path-id ownership and explore-token authorization
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    consentRequest: {
      findUnique: jest.fn(),
    },
    question: {
      findMany: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth/token.service', () => ({
  verifyUserAccessToken: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    logAPI: jest.fn(),
    error: jest.fn(),
  },
}));

import { POST } from '@/app/api/v1/students/[id]/diagnostic-result/route';
import { prisma } from '@/lib/prisma';
import { verifyUserAccessToken } from '@/lib/auth/token.service';

const mockVerifyUserAccessToken = verifyUserAccessToken as jest.MockedFunction<typeof verifyUserAccessToken>;
const mockConsentFindUnique = prisma.consentRequest.findUnique as jest.MockedFunction<
  typeof prisma.consentRequest.findUnique
>;

describe('POST /api/v1/students/{id}/diagnostic-result', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when token subject does not match route id', async () => {
    mockVerifyUserAccessToken.mockResolvedValue({
      sub: 'another-student',
      role: 'user',
      scope: 'user',
      jti: 'jti-1',
      iat: 1,
      exp: 2,
    });

    const req = new Request('http://localhost/api/v1/students/student-1/diagnostic-result', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer some-jwt',
      },
      body: JSON.stringify({
        answers: [{ questionId: 'q-1', selectedAnswer: 'A' }],
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'student-1' }) });
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(401);
    expect(body.error).toBe('unauthorized');
  });

  it('accepts explore token only when consent token belongs to the same student id', async () => {
    mockConsentFindUnique.mockResolvedValue({ studentId: 'student-1' } as never);
    (prisma.question.findMany as jest.Mock).mockResolvedValue([{ id: 'q-1', correctAnswer: 'A' }]);
    (prisma.user.update as jest.Mock).mockResolvedValue({
      id: 'student-1',
      onboardingDiagnosticScore: 1,
      onboardingPlacement: 'FOUNDATION',
    });

    const req = new Request('http://localhost/api/v1/students/student-1/diagnostic-result', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer explore:consent-token-1',
      },
      body: JSON.stringify({
        answers: [{ questionId: 'q-1', selectedAnswer: 'A' }],
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'student-1' }) });
    const body = (await res.json()) as { ok?: boolean; studentId?: string };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.studentId).toBe('student-1');
  });
});
