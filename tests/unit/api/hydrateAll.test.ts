/**
 * UNIT TESTS: HydrateAll API Endpoints
 *
 * Tests for:
 * - POST /api/admin/hydrateAll
 * - GET /api/admin/hydrateAll/:jobId
 * - DELETE /api/admin/hydrateAll/:jobId (cancel)
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

describe('POST /api/admin/hydrateAll', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('should create HydrationJob and Outbox entry in transaction', async () => {
    const mockRootJob = {
      id: 'job123',
      status: 'pending',
      createdAt: new Date('2026-01-30T10:00:00Z'),
      chaptersExpected: 12,
      estimatedCostUsd: 64.8,
      estimatedDurationMins: 994,
    };

    prismaMock.board.findUnique.mockResolvedValue({ id: 'board-1', slug: 'cbse', name: 'CBSE' });
    prismaMock.classLevel.findUnique.mockResolvedValue({ id: 'class-1', boardId: 'board-1', grade: 10 });
    prismaMock.subjectDef.findUnique.mockResolvedValue({ id: 'subj-1', name: 'Math', slug: 'math' });

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      return await callback({
        hydrationJob: { create: jest.fn().mockResolvedValue(mockRootJob) },
        outbox: { create: jest.fn().mockResolvedValue({ id: 'outbox123' }) },
      });
    });

    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    const { POST } = await import('@/app/api/admin/hydrateAll/route');
    const request = new Request('http://localhost:3000/api/admin/hydrateAll', {
      method: 'POST',
      body: JSON.stringify({
        language: 'en',
        boardCode: 'CBSE',
        grade: '10',
        subjectCode: 'math',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.rootJobId).toBe('job123');
    expect(data.status).toBe('pending');
    expect(data.estimates).toBeDefined();
    expect(data.estimates.totalChapters).toBe(12);
  });

  it('should reject request with missing required fields', async () => {
    const { POST } = await import('@/app/api/admin/hydrateAll/route');
    const request = new Request('http://localhost:3000/api/admin/hydrateAll', {
      method: 'POST',
      body: JSON.stringify({ language: 'en' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request as any);
    expect(response.status).toBe(400);
  });

  it('should reject invalid language', async () => {
    const { POST } = await import('@/app/api/admin/hydrateAll/route');
    const request = new Request('http://localhost:3000/api/admin/hydrateAll', {
      method: 'POST',
      body: JSON.stringify({
        language: 'fr',
        boardCode: 'CBSE',
        grade: '10',
        subjectCode: 'math',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request as any);
    expect(response.status).toBe(400);
  });

  it('should handle dry-run mode without creating job', async () => {
    prismaMock.board.findUnique.mockResolvedValue({ id: 'board-1', slug: 'cbse', name: 'CBSE' });
    prismaMock.classLevel.findUnique.mockResolvedValue({ id: 'class-1', boardId: 'board-1', grade: 10 });
    prismaMock.subjectDef.findUnique.mockResolvedValue({ id: 'subj-1', name: 'Math', slug: 'math' });

    const { POST } = await import('@/app/api/admin/hydrateAll/route');
    const request = new Request('http://localhost:3000/api/admin/hydrateAll', {
      method: 'POST',
      body: JSON.stringify({
        language: 'en',
        boardCode: 'CBSE',
        grade: '10',
        subjectCode: 'math',
        options: { dryRun: true },
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.rootJobId).toBe('dry-run');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/hydrateAll/:jobId', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('should return job progress with all fields', async () => {
    const mockJob = {
      id: 'job123',
      rootJobId: null,
      status: 'running',
      chaptersCompleted: 8,
      chaptersExpected: 12,
      topicsCompleted: 30,
      topicsExpected: 60,
      notesCompleted: 20,
      notesExpected: 60,
      questionsCompleted: 0,
      questionsExpected: 1800,
      estimatedCostUsd: 64.8,
      actualCostUsd: 15.2,
      estimatedDurationMins: 120,
      createdAt: new Date('2026-01-31T10:00:00Z'),
      lockedAt: new Date('2026-01-31T10:01:00Z'),
      completedAt: null,
      language: 'en',
      board: 'CBSE',
      grade: 10,
      subject: 'MATH',
      inputParams: { traceId: 'trace-123' },
    };

    prismaMock.hydrationJob.findUnique.mockResolvedValue(mockJob);
    prismaMock.hydrationJob.groupBy.mockResolvedValue([]);
    prismaMock.hydrationJob.findMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/admin/hydrateAll/[jobId]/route');
    const request = new Request('http://localhost:3000/api/admin/hydrateAll/job123');
    const response = await GET(request as any, { params: { jobId: 'job123' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.jobId).toBe('job123');
    expect(data.status).toBe('running');
    expect(data.progress.overall).toBeGreaterThan(0);
    expect(data.progress.levels.chapters.completed).toBe(8);
    expect(data.metadata.board).toBe('CBSE');
  });

  it('should return 404 for non-existent job', async () => {
    prismaMock.hydrationJob.findUnique.mockResolvedValue(null);

    const { GET } = await import('@/app/api/admin/hydrateAll/[jobId]/route');
    const request = new Request('http://localhost:3000/api/admin/hydrateAll/invalid');
    const response = await GET(request as any, { params: { jobId: 'invalid' } });

    expect(response.status).toBe(404);
  });

  it('should include child job summary for root job', async () => {
    const mockJob = {
      id: 'root-job',
      rootJobId: null,
      status: 'completed',
      chaptersCompleted: 5, chaptersExpected: 5,
      topicsCompleted: 16, topicsExpected: 16,
      notesCompleted: 16, notesExpected: 16,
      questionsCompleted: 144, questionsExpected: 144,
      estimatedCostUsd: 10, actualCostUsd: 8, estimatedDurationMins: 60,
      createdAt: new Date(), lockedAt: new Date(), completedAt: new Date(),
      language: 'en', board: 'CBSE', grade: 10, subject: 'Math',
      inputParams: {},
    };

    prismaMock.hydrationJob.findUnique.mockResolvedValue(mockJob);
    prismaMock.hydrationJob.groupBy.mockResolvedValue([
      { jobType: 'syllabus', status: 'completed', _count: 1 },
      { jobType: 'notes', status: 'completed', _count: 16 },
    ]);
    prismaMock.hydrationJob.findMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/admin/hydrateAll/[jobId]/route');
    const request = new Request('http://localhost:3000/api/admin/hydrateAll/root-job');
    const response = await GET(request as any, { params: { jobId: 'root-job' } });
    const data = await response.json();

    expect(data.childJobSummary).toBeDefined();
    expect(data.childJobSummary.syllabus).toBeDefined();
  });
});

describe('DELETE /api/admin/hydrateAll/:jobId', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('should cancel running job', async () => {
    prismaMock.hydrationJob.findUnique.mockResolvedValue({ id: 'job123', status: 'running' });
    prismaMock.hydrationJob.update.mockResolvedValue({ id: 'job123', status: 'cancelled' });
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    prismaMock.jobExecutionLog.create.mockResolvedValue({ id: 'log-1' });

    const { DELETE } = await import('@/app/api/admin/hydrateAll/[jobId]/route');
    const request = new Request('http://localhost:3000/api/admin/hydrateAll/job123', { method: 'DELETE' });
    const response = await DELETE(request as any, { params: { jobId: 'job123' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.newStatus).toBe('cancelled');
  });

  it('should not cancel completed job', async () => {
    prismaMock.hydrationJob.findUnique.mockResolvedValue({ id: 'job123', status: 'completed' });

    const { DELETE } = await import('@/app/api/admin/hydrateAll/[jobId]/route');
    const request = new Request('http://localhost:3000/api/admin/hydrateAll/job123', { method: 'DELETE' });
    const response = await DELETE(request as any, { params: { jobId: 'job123' } });

    expect(response.status).toBe(400);
  });

  it('should return 404 for non-existent job', async () => {
    prismaMock.hydrationJob.findUnique.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/admin/hydrateAll/[jobId]/route');
    const request = new Request('http://localhost:3000/api/admin/hydrateAll/noexist', { method: 'DELETE' });
    const response = await DELETE(request as any, { params: { jobId: 'noexist' } });

    expect(response.status).toBe(404);
  });
});
