/**
 * FILE OBJECTIVE:
 * - Unit tests for readiness drop worker: ensure parent email/SMS and student push
 *   notifications are triggered when readiness drops > threshold.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/readinessDropWorker.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | senior-engineer | add student push expectations and mocks
 */
/* eslint-disable @typescript-eslint/no-require-imports */

// Prevent real OpenAI calls: callLLM is gated by ALLOW_LLM_CALLS=1 which is set in
// forceTestNodeEnv.cjs. Mock the module so no HTTP requests are made during unit tests.
const mockCallLLM = jest.fn();
jest.mock('@/lib/callLLM', () => ({ callLLM: (...a: any[]) => mockCallLLM(...a) }));

let processReadinessDropAlerts: any;
const mockParentFind = jest.fn();
const mockPlansFind = jest.fn();
const mockSubjectDefsFind = jest.fn();
const mockAIContentLogCreate = jest.fn();
const mockAnalyticsCreate = jest.fn();
const mockAITutorTurnLogCreate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    parentStudent: { findMany: (...a: any[]) => mockParentFind(...a) },
    learningPlan: { findMany: (...a: any[]) => mockPlansFind(...a) },
    subjectDef: { findMany: (...a: any[]) => mockSubjectDefsFind(...a) },
    aIContentLog: { create: (...a: any[]) => mockAIContentLogCreate(...a) },
    analyticsEvent: { create: (...a: any[]) => mockAnalyticsCreate(...a) },
    aITutorTurnLog: { create: (...a: any[]) => mockAITutorTurnLogCreate(...a) },
  },
}));

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn(() => ({ get: mockRedisGet, set: mockRedisSet })),
}));

const mockCompute = jest.fn();
jest.mock('@/lib/student/examReadiness', () => ({
  computeReadinessScore: (...a: any[]) => mockCompute(...a),
}));

const mockSendMail = jest.fn();
jest.mock('@/lib/mailer', () => ({ sendMailSafe: (...a: any[]) => mockSendMail(...a) }));

const mockSendSms = jest.fn();
jest.mock('@/lib/sms', () => ({ sendSms: (...a: any[]) => mockSendSms(...a) }));

const mockSendPush = jest.fn();
jest.mock('@/lib/push/send', () => ({ sendPushSafe: (...a: any[]) => mockSendPush(...a) }));

beforeAll(() => {
  // Require the module after mocks to ensure external clients (Prisma/Redis)
  // are mocked and do not open real connections that keep Jest alive.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  processReadinessDropAlerts =
    require('@/worker/services/readinessDropWorker').processReadinessDropAlerts;
});

beforeEach(() => {
  mockCallLLM.mockReset();
  mockCallLLM.mockRejectedValue(new Error('callLLM mocked in unit tests'));
  mockParentFind.mockReset();
  mockPlansFind.mockReset();
  mockSubjectDefsFind.mockReset();
  mockAIContentLogCreate.mockReset();
  mockAnalyticsCreate.mockReset();
  mockAITutorTurnLogCreate.mockReset();
  mockRedisGet.mockReset();
  mockRedisSet.mockReset();
  mockCompute.mockReset();
  mockSendMail.mockReset();
  mockSendSms.mockReset();
  mockSendPush.mockReset();
});

test('detects readiness drop and notifies parent', async () => {
  const studentId = 's1';
  const parentId = 'p1';
  const subjectId = 'sub1';
  const examDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  mockParentFind.mockResolvedValueOnce([
    { parentId, studentId, parent: { name: 'Ajay', email: 'a@example.com', phone: '9000000000' } },
  ]);
  mockPlansFind.mockResolvedValueOnce([{ studentId, subjectId, examDate }]);
  mockSubjectDefsFind.mockResolvedValueOnce([{ id: subjectId, name: 'Mathematics' }]);

  // Redis snapshot 7 days ago = 80
  mockRedisGet.mockImplementation(async (key: string) => {
    if (key.includes('readiness:history')) return '80';
    return null;
  });

  // Current readiness = 65
  mockCompute.mockResolvedValueOnce({ score: 65, label: 'Needs Work', chapters: [] });

  await processReadinessDropAlerts(new Date());

  expect(mockSendMail).toHaveBeenCalled();
  expect(mockSendSms).toHaveBeenCalled();
  // Student push should be sent
  expect(mockSendPush).toHaveBeenCalledWith(studentId, expect.any(Object));
  // Rate-limit keys set (parent + student)
  expect(mockRedisSet.mock.calls.length).toBeGreaterThanOrEqual(1);
});
