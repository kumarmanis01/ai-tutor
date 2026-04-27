/**
 * UNIT TESTS: GET /api/admin/hydrateAll (list jobs)
 * and GET /api/admin/hydrateAll/stats
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('nanoid', () => ({ nanoid: () => 'mock-nanoid-123456' }));
jest.mock('@/lib/metrics/hydrateMetrics', () => ({ incrementCreated: jest.fn() }));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock';
import '../../helpers/mockSession';

describe('GET /api/admin/hydrateAll (list root jobs)', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('should return list of root jobs', async () => {
    const mockJobs = [
      {
        id: 'job-1',
        status: 'completed',
        board: 'CBSE',
        grade: 10,
        subject: 'Math',
        language: 'en',
        createdAt: new Date('2026-01-30T10:00:00Z'),
        completedAt: new Date('2026-01-30T11:00:00Z'),
        chaptersExpected: 5,
        chaptersCompleted: 5,
        topicsExpected: 16,
        topicsCompleted: 16,
        notesExpected: 16,
        notesCompleted: 16,
        questionsExpected: 144,
        questionsCompleted: 144,
        actualCostUsd: 10.5,
      },
      {
        id: 'job-2',
        status: 'pending',
        board: 'ICSE',
        grade: 8,
        subject: 'Science',
        language: 'hi',
        createdAt: new Date('2026-01-31T10:00:00Z'),
        completedAt: null,
        chaptersExpected: 12,
        chaptersCompleted: 0,
        topicsExpected: 60,
        topicsCompleted: 0,
        notesExpected: 60,
        notesCompleted: 0,
        questionsExpected: 1800,
        questionsCompleted: 0,
        actualCostUsd: 0,
      },
    ];

    prismaMock.hydrationJob.findMany.mockResolvedValue(mockJobs);

    const { GET } = await import('@/app/api/admin/hydrateAll/route');
    const request = new Request('http://localhost:3000/api/admin/hydrateAll');
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.jobs).toHaveLength(2);
    expect(data.jobs[0].id).toBe('job-1');
    expect(data.jobs[0].status).toBe('completed');
    expect(data.jobs[0].metadata.board).toBe('CBSE');
    expect(data.jobs[0].progress.overall).toBe(100);
    expect(data.jobs[1].progress.overall).toBe(0);
  });

  it('should filter by status', async () => {
    prismaMock.hydrationJob.findMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/admin/hydrateAll/route');
    const request = new Request('http://localhost:3000/api/admin/hydrateAll?status=running');
    await GET(request as any);

    expect(prismaMock.hydrationJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rootJobId: null, status: 'running' },
      })
    );
  });

  it('should handle empty results', async () => {
    prismaMock.hydrationJob.findMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/admin/hydrateAll/route');
    const request = new Request('http://localhost:3000/api/admin/hydrateAll');
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.jobs).toHaveLength(0);
  });
});

describe('GET /api/admin/hydrateAll/stats', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('should return stats summary', async () => {
    prismaMock.hydrationJob.count
      .mockResolvedValueOnce(5) // totalJobs
      .mockResolvedValueOnce(1) // runningJobs
      .mockResolvedValueOnce(3); // completedToday

    prismaMock.hydrationJob.aggregate.mockResolvedValue({
      _sum: { actualCostUsd: 12.5 },
    });

    const { GET } = await import('@/app/api/admin/hydrateAll/stats/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalJobs).toBe(5);
    expect(data.runningJobs).toBe(1);
    expect(data.completedToday).toBe(3);
    expect(data.totalCostToday).toBe(12.5);
  });

  it('should handle null cost aggregation', async () => {
    prismaMock.hydrationJob.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    prismaMock.hydrationJob.aggregate.mockResolvedValue({
      _sum: { actualCostUsd: null },
    });

    const { GET } = await import('@/app/api/admin/hydrateAll/stats/route');
    const response = await GET();
    const data = await response.json();

    expect(data.totalCostToday).toBe(0);
  });
});
