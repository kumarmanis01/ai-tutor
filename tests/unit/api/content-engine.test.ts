/**
 * UNIT TESTS: Content Engine API endpoints
 * - GET /api/admin/content-engine/status
 * - GET /api/admin/content-engine/summary
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/auth', () => ({ authOptions: {}, requireAdminOrModerator: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/systemSettings', () => ({
  isSystemSettingEnabled: (val: any) => val === 'true' || val === '1' || val === true,
}));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/lib/session', () => ({
  requireAdminOrModerator: jest.fn().mockResolvedValue(undefined),
  getServerSessionForHandlers: jest.fn().mockResolvedValue({
    user: { id: 'test-user', email: 'admin@test.com', role: 'admin' },
  }),
}));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock';

describe('GET /api/admin/content-engine/summary', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('should return combined job and content summary', async () => {
    // ExecutionJob counts
    prismaMock.executionJob.count
      .mockResolvedValueOnce(2) // queued
      .mockResolvedValueOnce(1) // running
      .mockResolvedValueOnce(0) // failed
      .mockResolvedValueOnce(5); // completedToday

    // HydrationJob counts
    prismaMock.hydrationJob.count
      .mockResolvedValueOnce(3) // pending
      .mockResolvedValueOnce(1) // running
      .mockResolvedValueOnce(10) // completed
      .mockResolvedValueOnce(0); // failed

    // Content counts
    prismaMock.chapterDef.count.mockResolvedValue(15);
    prismaMock.topicDef.count.mockResolvedValue(60);
    prismaMock.topicNote.count.mockResolvedValue(45);
    prismaMock.generatedQuestion.count.mockResolvedValue(300);

    const { GET } = await import('@/app/api/admin/content-engine/summary/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.queued).toBe(5); // 2 exec + 3 hydration
    expect(data.running).toBe(2); // 1 exec + 1 hydration
    expect(data.failed).toBe(0);
    expect(data.completedToday).toBe(5);
    expect(data.hydration.pending).toBe(3);
    expect(data.hydration.running).toBe(1);
    expect(data.hydration.completed).toBe(10);
    expect(data.content.chapters).toBe(15);
    expect(data.content.topics).toBe(60);
    expect(data.content.notes).toBe(45);
    expect(data.content.questions).toBe(300);
  });
});

describe('GET /api/admin/content-engine/status', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('should return running when AI is not paused', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue(null);

    const { GET } = await import('@/app/api/admin/content-engine/status/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('running');
    expect(data.paused).toBe(false);
  });

  it('should return paused when AI_PAUSED is true', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({ key: 'AI_PAUSED', value: 'true' });

    const { GET } = await import('@/app/api/admin/content-engine/status/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('paused');
    expect(data.paused).toBe(true);
  });
});
