/**
 * FILE OBJECTIVE:
 * - Unit tests for the doubt escalation notifier worker.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/doubtEscalationNotifier.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | senior-engineer | add unit test for notifier
 */

const mockFindMany = jest.fn();
const mockConceptFind = jest.fn();
const mockDoubtKbCreate = jest.fn();
const mockEscUpdate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    doubtEscalation: {
      findMany: (...a: any[]) => mockFindMany(...a),
      update: (...a: any[]) => mockEscUpdate(...a),
    },
    concept: { findUnique: (...a: any[]) => mockConceptFind(...a) },
    doubtKb: { create: (...a: any[]) => mockDoubtKbCreate(...a) },
  },
}));

const mockRecordDoubt = jest.fn();
jest.mock('@/lib/ai/tutor/doubtKb', () => ({
  recordDoubt: (...a: any[]) => mockRecordDoubt(...a),
}));

const mockSendPushToUser = jest.fn();
jest.mock('@/lib/push/send', () => ({ sendPushToUser: (...a: any[]) => mockSendPushToUser(...a) }));

let processDoubtEscalationNotifications: any;
beforeAll(() => {
  // require after mocks
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  processDoubtEscalationNotifications =
    require('@/worker/services/doubtEscalationNotifier').processDoubtEscalationNotifications;
});

beforeEach(() => {
  mockFindMany.mockReset();
  mockConceptFind.mockReset();
  mockDoubtKbCreate.mockReset();
  mockEscUpdate.mockReset();
  mockRecordDoubt.mockReset();
  mockSendPushToUser.mockReset();
});

test('processes resolved escalations: caches answer and notifies student', async () => {
  const now = new Date();
  const esc = {
    id: 'esc1',
    studentId: 's1',
    sessionId: 'sess1',
    conceptId: 'c1',
    doubtText: 'Why is 2+2 4?',
    resolutionNote: 'Because addition is defined that way.',
    resolvedAt: now,
  };

  mockFindMany.mockResolvedValueOnce([esc]);
  mockConceptFind.mockResolvedValueOnce({ subjectId: 'sub1' });
  mockRecordDoubt.mockResolvedValueOnce(undefined);
  mockSendPushToUser.mockResolvedValueOnce({ sent: 1, failed: 0 });
  mockEscUpdate.mockResolvedValueOnce({});

  const processed = await processDoubtEscalationNotifications();

  expect(processed).toBe(1);
  expect(mockRecordDoubt).toHaveBeenCalledWith(esc.doubtText, esc.resolutionNote, 'sub1', 'c1');
  expect(mockSendPushToUser).toHaveBeenCalledWith('s1', expect.any(Object));
  expect(mockEscUpdate).toHaveBeenCalledWith({
    where: { id: 'esc1' },
    data: { notifiedAt: expect.any(Date) },
  });
});
