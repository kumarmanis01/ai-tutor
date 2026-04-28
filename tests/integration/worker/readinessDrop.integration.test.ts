import { processReadinessDropAlerts } from '@/worker/services/readinessDropWorker';

const mockParentFind = jest.fn();
const mockPlansFind = jest.fn();
const mockSubjectDefsFind = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    parentStudent: { findMany: (...a: any[]) => mockParentFind(...a) },
    learningPlan: { findMany: (...a: any[]) => mockPlansFind(...a) },
    subjectDef: { findMany: (...a: any[]) => mockSubjectDefsFind(...a) },
  },
}));

const mockCompute = jest.fn();
jest.mock('@/lib/student/examReadiness', () => ({
  computeReadinessScore: (...a: any[]) => mockCompute(...a),
}));

const mockCallLLM = jest.fn();
jest.mock('@/lib/callLLM', () => ({
  callLLM: (...a: any[]) => Promise.resolve(mockCallLLM(...a)),
}));

const mockSendMail = jest.fn();
jest.mock('@/lib/mailer', () => ({
  sendMailSafe: (...a: any[]) => Promise.resolve(mockSendMail(...a)),
}));

const mockSendSms = jest.fn();
jest.mock('@/lib/sms', () => ({ sendSms: (...a: any[]) => Promise.resolve(mockSendSms(...a)) }));

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn(() => ({ get: mockRedisGet, set: mockRedisSet })),
}));

beforeEach(() => {
  mockParentFind.mockReset();
  mockPlansFind.mockReset();
  mockSubjectDefsFind.mockReset();
  mockRedisGet.mockReset();
  mockRedisSet.mockReset();
  mockCompute.mockReset();
  mockCallLLM.mockReset();
  mockSendMail.mockReset();
  mockSendSms.mockReset();
});

test('integration: readiness drop alerts send remediation', async () => {
  const studentId = 's1';
  const parentId = 'p1';
  const subjectId = 'sub1';
  const examDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  mockParentFind.mockResolvedValueOnce([
    { parentId, studentId, parent: { name: 'Kiran', email: 'k@example.com', phone: '9000000001' } },
  ]);
  mockPlansFind.mockResolvedValueOnce([{ studentId, subjectId, examDate }]);
  mockSubjectDefsFind.mockResolvedValueOnce([{ id: subjectId, name: 'Mathematics' }]);

  // previous snapshot 7 days ago
  mockRedisGet.mockImplementation(async (key: string) => {
    if (key.includes('readiness:history')) return '80';
    return null;
  });

  // current score drops to 65
  mockCompute.mockResolvedValueOnce({ score: 65, label: 'Needs Work', chapters: [] });

  mockCallLLM.mockResolvedValue({ content: 'Focus on topic X' });

  await processReadinessDropAlerts(new Date());

  expect(mockCallLLM).toHaveBeenCalled();
  expect(mockSendMail).toHaveBeenCalled();
  expect(mockSendSms).toHaveBeenCalled();
  expect(mockRedisSet).toHaveBeenCalled();
});
