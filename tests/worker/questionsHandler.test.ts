jest.mock('@/lib/callLLM.js', () => ({
  callLLM: jest.fn().mockResolvedValue({ content: JSON.stringify({ questions: [{ type: 'numeric', question: '2+2', answer: '4' }] }) })
}));

const mockPrisma = {
  hydrationJob: {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    findUnique: jest.fn().mockResolvedValue({ id: 'jobQ1', topicId: 'topicQ1', language: 'en' }),
    update: jest.fn().mockResolvedValue({})
  },
  systemSetting: { findUnique: jest.fn().mockResolvedValue(null) },
  topicDef: { findUnique: jest.fn().mockResolvedValue({ id: 'topicQ1', name: 'TopicQ', chapter: { name: 'ChapterQ', subject: { name: 'Mathematics', class: { grade: 7, board: { name: 'CBSE' } } } } }) },
  generatedTest: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'test1' }) },
  generatedQuestion: { create: jest.fn().mockResolvedValue({}) },
  $transaction: jest.fn().mockImplementation(async (work: any) => work(mockPrisma)),
  executionJob: { findFirst: jest.fn().mockResolvedValue({ id: 'execQ1', payload: { hydrationJobId: 'jobQ1' }, status: 'pending' }), update: jest.fn().mockResolvedValue({}) },
  jobExecutionLog: { create: jest.fn().mockResolvedValue({}) }
};

jest.mock('@/lib/prisma.js', () => ({ prisma: mockPrisma }));

import { handleQuestionsJob } from '@/worker/services/questionsWorker';
import { prisma } from '@/lib/prisma.js';

describe('handleQuestionsJob validation behavior', () => {
  beforeEach(() => jest.clearAllMocks());

  test('invalid question output triggers VALIDATION_REPORT and is rejected for math subject', async () => {
    // Our mocked LLM returns a simple answer string for a math question; validation should fail
    await expect(handleQuestionsJob('jobQ1')).rejects.toThrow();

    const calls = (prisma as any).jobExecutionLog.create.mock.calls;
    const events = calls.map((c: any) => c[0]?.data?.event).filter(Boolean);
    expect(events).toContain('VALIDATION_REPORT');

    // Hydration job updated to failed at some point
    expect((prisma as any).hydrationJob.update).toHaveBeenCalled();
  });
});
