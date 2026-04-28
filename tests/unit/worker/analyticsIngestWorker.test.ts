/**
 * FILE OBJECTIVE:
 * - Unit tests for worker/services/analyticsIngestWorker.ts processAnalyticsIngest.
 * - Mocks Prisma to verify the correct create() call is made and that errors
 *   are re-thrown (so BullMQ can retry the job).
 *
 * EDIT LOG:
 * - 2026-04-21 | staff-engineer | review fix: add missing worker unit tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const createMock = jest.fn();

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn() })),
  Job: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({ prisma: { analyticsEvent: { create: createMock } } }));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock('@/lib/redis', () => ({ redisConnection: {} }));
jest.mock('@/lib/queues/constants', () => ({ ANALYTICS_INGEST_QUEUE: 'analytics-ingest' }));

import { processAnalyticsIngest } from '@/worker/services/analyticsIngestWorker';
import type { AnalyticsIngestPayload } from '@/worker/services/analyticsIngestWorker';

function makeJob(data: Partial<AnalyticsIngestPayload>) {
  return { id: 'job-1', data } as any;
}

beforeEach(() => {
  createMock.mockReset();
});

describe('processAnalyticsIngest', () => {
  it('should call prisma.analyticsEvent.create with the correct data', async () => {
    createMock.mockResolvedValue({ id: 'ev-1' });

    await processAnalyticsIngest(
      makeJob({
        eventType: 'lesson_viewed',
        userId: 'u1',
        courseId: 'c1',
        lessonIdx: 3,
        metadata: { timeSpent: 60 },
      })
    );

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        eventType: 'lesson_viewed',
        userId: 'u1',
        courseId: 'c1',
        lessonIdx: 3,
        metadata: { timeSpent: 60 },
      },
    });
  });

  it('should coerce null userId/courseId/lessonIdx correctly', async () => {
    createMock.mockResolvedValue({ id: 'ev-2' });

    await processAnalyticsIngest(
      makeJob({
        eventType: 'page_view',
        userId: null,
        courseId: null,
        lessonIdx: null,
        metadata: {},
      })
    );

    const call = createMock.mock.calls[0][0].data;
    expect(call.userId).toBeNull();
    expect(call.courseId).toBeNull();
    expect(call.lessonIdx).toBeNull();
  });

  it('should use empty object as metadata fallback when metadata is undefined', async () => {
    createMock.mockResolvedValue({ id: 'ev-3' });

    await processAnalyticsIngest(
      makeJob({
        eventType: 'page_view',
        userId: null,
        courseId: null,
        lessonIdx: null,
        metadata: undefined as any,
      })
    );

    expect(createMock.mock.calls[0][0].data.metadata).toEqual({});
  });

  it('should re-throw errors so BullMQ can retry the job', async () => {
    createMock.mockRejectedValue(new Error('DB connection lost'));

    await expect(
      processAnalyticsIngest(
        makeJob({
          eventType: 'lesson_viewed',
          userId: 'u1',
          courseId: null,
          lessonIdx: null,
          metadata: {},
        })
      )
    ).rejects.toThrow('DB connection lost');
  });
});
