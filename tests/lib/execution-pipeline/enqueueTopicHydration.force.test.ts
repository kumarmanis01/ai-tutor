/**
 * FILE OBJECTIVE:
 * - Verify `enqueueNotesHydration` `force` behaviour: idempotency vs forced enqueue.
 *
 * LINKED UNIT TEST:
 * - tests/lib/execution-pipeline/enqueueTopicHydration.force.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/AI_Execution_pipeline.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-11T00:00:00Z | copilot | add tests for force behaviour
 * - 2026-05-08T00:00:00Z | copilot | add force + questionsPerDifficulty tests for questions hydration
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    systemSetting: { findUnique: jest.fn() },
    topicDef: { findUnique: jest.fn() },
    topicNote: { findFirst: jest.fn() },
    generatedTest: { findFirst: jest.fn() },
    hydrationJob: { findFirst: jest.fn(), create: jest.fn() },
    outbox: { create: jest.fn() },
  },
}));

const { prisma } = require('@/lib/prisma');
const {
  enqueueNotesHydration,
  enqueueQuestionsHydration,
} = require('@/lib/execution-pipeline/enqueueTopicHydration');

describe('enqueueNotesHydration force behaviour', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns content_exists when approved notes exist and force=false', async () => {
    prisma.systemSetting.findUnique.mockResolvedValue(null);
    prisma.topicDef.findUnique.mockResolvedValue({
      id: 't1',
      name: 'Topic 1',
      chapter: { id: 'c1', name: 'Chapter 1', subject: { id: 's1', name: 'S', class: { grade: 9, board: { name: 'CBSE' } } } },
    });
    prisma.topicNote.findFirst.mockResolvedValue({ id: 'note1' });

    const res = await enqueueNotesHydration({ topicId: 't1', language: 'en', force: false });
    expect(res.created).toBe(false);
    expect(res.reason).toBe('content_exists');
  });

  it('proceeds when force=true and no queued job exists (creates job + outbox)', async () => {
    prisma.systemSetting.findUnique.mockResolvedValue(null);
    prisma.topicDef.findUnique.mockResolvedValue({
      id: 't1',
      name: 'Topic 1',
      chapter: { id: 'c1', name: 'Chapter 1', subject: { id: 's1', name: 'S', class: { grade: 9, board: { name: 'CBSE' } } } },
    });
    // topicNote exists but force=true skips content check
    prisma.topicNote.findFirst.mockResolvedValue({ id: 'note1' });
    prisma.hydrationJob.findFirst.mockResolvedValue(null);
    prisma.hydrationJob.create.mockResolvedValue({ id: 'job-123' });
    prisma.outbox.create.mockResolvedValue({ id: 'out-456' });

    const res = await enqueueNotesHydration({ topicId: 't1', language: 'en', force: true });
    expect(res.created).toBe(true);
    expect(res.jobId).toBe('job-123');
    expect(res.outboxId).toBe('out-456');
  });

  it('returns job_already_queued when force=true but existing queued job is present', async () => {
    prisma.systemSetting.findUnique.mockResolvedValue(null);
    prisma.topicDef.findUnique.mockResolvedValue({
      id: 't1',
      name: 'Topic 1',
      chapter: { id: 'c1', name: 'Chapter 1', subject: { id: 's1', name: 'S', class: { grade: 9, board: { name: 'CBSE' } } } },
    });
    prisma.topicNote.findFirst.mockResolvedValue({ id: 'note1' });
    prisma.hydrationJob.findFirst.mockResolvedValue({ id: 'job-existing' });

    const res = await enqueueNotesHydration({ topicId: 't1', language: 'en', force: true });
    expect(res.created).toBe(false);
    expect(res.reason).toBe('job_already_queued');
    expect(res.jobId).toBe('job-existing');
  });
});

describe('enqueueQuestionsHydration force behaviour', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns content_exists when approved generated test exists and force=false', async () => {
    prisma.systemSetting.findUnique.mockResolvedValue(null);
    prisma.topicDef.findUnique.mockResolvedValue({
      id: 't1',
      name: 'Topic 1',
      chapter: { id: 'c1', name: 'Chapter 1', subject: { id: 's1', name: 'S', class: { grade: 9, board: { name: 'CBSE' } } } },
    });
    prisma.generatedTest.findFirst.mockResolvedValue({ id: 'gt-1' });

    const res = await enqueueQuestionsHydration({
      topicId: 't1',
      language: 'en',
      difficulty: 'medium',
      force: false,
    });

    expect(res.created).toBe(false);
    expect(res.reason).toBe('content_exists');
  });

  it('creates questions hydration with questionsPerDifficulty when force=true', async () => {
    prisma.systemSetting.findUnique.mockResolvedValue(null);
    prisma.topicDef.findUnique.mockResolvedValue({
      id: 't1',
      name: 'Topic 1',
      chapter: { id: 'c1', name: 'Chapter 1', subject: { id: 's1', name: 'S', class: { grade: 9, board: { name: 'CBSE' } } } },
    });
    prisma.generatedTest.findFirst.mockResolvedValue({ id: 'gt-1' });
    prisma.hydrationJob.findFirst.mockResolvedValue(null);
    prisma.hydrationJob.create.mockResolvedValue({ id: 'job-q-1' });
    prisma.outbox.create.mockResolvedValue({ id: 'out-q-1' });

    const res = await enqueueQuestionsHydration({
      topicId: 't1',
      language: 'en',
      difficulty: 'medium',
      force: true,
      questionsPerDifficulty: 10,
    });

    expect(res.created).toBe(true);
    expect(res.jobId).toBe('job-q-1');

    expect(prisma.hydrationJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inputParams: { questionsPerDifficulty: 10 },
        }),
      }),
    );
  });
});
