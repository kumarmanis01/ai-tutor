jest.mock('@/lib/callLLM.js', () => ({
  callLLM: jest.fn().mockResolvedValue({ content: JSON.stringify({ title: 'T', content: { explanation: 'x' } }) })
}));

const mockPrisma = {
  hydrationJob: {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    findUnique: jest.fn().mockResolvedValue({ id: 'job1', topicId: 'topic1', language: 'en' }),
    update: jest.fn().mockResolvedValue({})
  },
  systemSetting: { findUnique: jest.fn().mockResolvedValue(null) },
  topicDef: { findUnique: jest.fn().mockResolvedValue({ id: 'topic1', name: 'Topic', chapter: { name: 'Chapter', subject: { name: 'Mathematics', class: { grade: 6, board: { name: 'CBSE' } } } } }) },
  topicNote: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
  aIContentLog: { create: jest.fn().mockResolvedValue({}) },
  $transaction: jest.fn().mockImplementation(async (work: any) => work(mockPrisma)),
  executionJob: { findFirst: jest.fn().mockResolvedValue({ id: 'exec1', payload: { hydrationJobId: 'job1' }, status: 'pending' }), update: jest.fn().mockResolvedValue({}) },
  jobExecutionLog: { create: jest.fn().mockResolvedValue({}) }
};

jest.mock('@/lib/prisma.js', () => ({ prisma: mockPrisma }));

import { handleNotesJob } from '@/worker/services/notesWorker';
import { prisma } from '@/lib/prisma.js';

describe('handleNotesJob validation behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('invalid parsed notes cause validation failure, job fails, and AIContentLog persisted', async () => {
    await expect(handleNotesJob('job1')).rejects.toThrow();

    // VALIDATION_FAILED should be created
    const calls = (prisma as any).jobExecutionLog.create.mock.calls;
    const events = calls.map((c: any) => c[0]?.data?.event).filter(Boolean);
    expect(events).toContain('VALIDATION_FAILED');

    // hydrationJob updated to failed
    expect((prisma as any).hydrationJob.update).toHaveBeenCalled();

    // AI content log must be persisted with failure mark
    expect((prisma as any).aIContentLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ success: false, status: 'failed' }) }));
  });
});
