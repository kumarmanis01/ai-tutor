/**
 * FILE OBJECTIVE:
 * - Unit tests for DELETE /api/v1/students/{id} anonymize endpoint safeguards.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/students/[id]/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T13:30:00Z | copilot | add tests for consent mismatch and non-pending consent terminal guard
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    consentRequest: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    logAPI: jest.fn(),
    error: jest.fn(),
  },
}));

import { DELETE } from '@/app/api/v1/students/[id]/route';
import { prisma } from '@/lib/prisma';

const mockFindUnique = prisma.consentRequest.findUnique as jest.MockedFunction<
  typeof prisma.consentRequest.findUnique
>;
const mockTransaction = prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>;

describe('DELETE /api/v1/students/{id}', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when consent request does not belong to student', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'cr-1',
      studentId: 'different-student',
      status: 'PENDING',
    } as never);

    const req = new Request('http://localhost/api/v1/students/student-1?consent_token=t-1', {
      method: 'DELETE',
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: 'student-1' }) });
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(403);
    expect(body.error).toBe('consent_mismatch');
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns 409 when consent request status is terminal (not PENDING)', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'cr-2',
      studentId: 'student-1',
      status: 'APPROVED',
    } as never);

    const req = new Request('http://localhost/api/v1/students/student-1?consent_token=t-2', {
      method: 'DELETE',
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: 'student-1' }) });
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(409);
    expect(body.error).toBe('consent_request_not_pending');
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
