jest.mock('@/lib/prisma', () => ({
  prisma: {
    hydrationJob: { count: jest.fn(), findMany: jest.fn() },
    topicDef: { findMany: jest.fn() },
    adminConfig: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

const { prisma } = require('@/lib/prisma');

import {
  getReadinessSummary,
  getReadinessList,
  getGenerationPaused,
  setGenerationPaused,
} from '@/lib/admin/contentReadiness';

describe('contentReadiness', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getReadinessSummary returns counts', async () => {
    prisma.hydrationJob.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4);

    const res = await getReadinessSummary();
    expect(res).toEqual({ pending: 1, running: 2, failed: 3, completed: 4 });
  });

  test('getReadinessList returns items and total', async () => {
    prisma.hydrationJob.count.mockResolvedValue(1);
    prisma.hydrationJob.findMany.mockResolvedValue([
      {
        id: 'j1',
        topicId: 't1',
        status: 'pending',
        contentReady: false,
        lastError: null,
        updatedAt: new Date(),
      },
    ]);
    prisma.topicDef.findMany.mockResolvedValue([
      {
        id: 't1',
        name: 'Topic 1',
        chapterId: 'c1',
        chapter: { name: 'Chapter 1', subjectId: 's1', subject: { name: 'Subject 1' } },
      },
    ]);

    const { items, total } = await getReadinessList({});
    expect(total).toBe(1);
    expect(items[0].topicName).toBe('Topic 1');
  });

  test('getGenerationPaused and setGenerationPaused', async () => {
    prisma.adminConfig.findUnique.mockResolvedValue({ value: '1' });
    expect(await getGenerationPaused()).toBe(true);
    await setGenerationPaused(false);
    expect(prisma.adminConfig.upsert).toHaveBeenCalled();
  });
});
