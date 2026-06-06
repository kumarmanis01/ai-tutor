/**
 * FILE OBJECTIVE:
 * - Unit tests for worker/outboxDispatcher.ts
 *
 * LINKED UNIT TEST:
 * - (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-21T00:00:00Z | copilot-agent | created unit tests for outbox dispatcher
 */

import { dispatchBatch } from '@/worker/outboxDispatcher';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    outbox: {
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
    outboxDeadLetter: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((fn) => (Array.isArray(fn) ? Promise.all(fn.map((f: any) => f)) : fn())),
  },
}));

jest.mock('@/lib/redis', () => ({
  redisConnection: { host: 'localhost', port: 6379 },
  getSharedConnection: jest.fn(() => ({ host: 'localhost', port: 6379 })),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'bull-job-123' }),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { prisma } from '@/lib/prisma';

describe('outboxDispatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('dispatchBatch', () => {
    it('returns 0 when no unsent rows exist', async () => {
      (prisma.outbox.findMany as jest.Mock).mockResolvedValue([]);

      const count = await dispatchBatch();

      expect(count).toBe(0);
      expect(prisma.outbox.findMany).toHaveBeenCalledWith({
        where: { sentAt: null },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });
    });

    it('dispatches unsent rows to BullMQ and marks them sent', async () => {
      const mockRow = {
        id: 'outbox-1',
        payload: { type: 'SYLLABUS', payload: { jobId: 'hyd-123' } },
        attempts: 0,
        createdAt: new Date(),
      };

      (prisma.outbox.findMany as jest.Mock).mockResolvedValue([mockRow]);
      (prisma.outbox.update as jest.Mock).mockResolvedValue({});

      const count = await dispatchBatch();

      expect(count).toBe(1);
      expect(prisma.outbox.update).toHaveBeenCalledWith({
        where: { id: 'outbox-1' },
        data: { sentAt: expect.any(Date), attempts: 1 },
      });
    });

    it('increments attempts but does not mark sent on dispatch failure', async () => {
      const mockRow = {
        id: 'outbox-2',
        queue: 'content-hydration',
        payload: { type: 'SYLLABUS', payload: { jobId: 'hyd-456' } },
        meta: null,
        attempts: 1,
        createdAt: new Date(),
      };

      (prisma.outbox.findMany as jest.Mock).mockResolvedValue([mockRow]);

      // prisma.update (mark sent) throws — we go to catch, increment attempts
      (prisma.outbox.update as jest.Mock)
        .mockRejectedValueOnce(new Error('Redis connection failed'))
        .mockResolvedValue({});

      const count = await dispatchBatch();

      expect(count).toBe(0);
      expect(prisma.outbox.update).toHaveBeenCalledWith({
        where: { id: 'outbox-2' },
        data: { attempts: 2 },
      });
    });

    it('moves to dead-letter when attempts >= MAX_ATTEMPTS', async () => {
      const mockRow = {
        id: 'outbox-dl',
        queue: 'content-hydration',
        payload: { type: 'SYLLABUS', payload: { jobId: 'hyd-789' } },
        meta: null,
        attempts: 10,
        createdAt: new Date(),
      };

      (prisma.outbox.findMany as jest.Mock).mockResolvedValue([mockRow]);
      (prisma.outboxDeadLetter.create as jest.Mock).mockResolvedValue({});
      (prisma.outbox.delete as jest.Mock).mockResolvedValue({});
      (prisma.$transaction as jest.Mock).mockImplementation((arg: unknown) =>
        Array.isArray(arg) ? Promise.all(arg as Promise<unknown>[]) : (arg as () => Promise<unknown>)()
      );

      const count = await dispatchBatch();

      expect(count).toBe(0);
      expect(prisma.outboxDeadLetter.create).toHaveBeenCalled();
      expect(prisma.outbox.delete).toHaveBeenCalledWith({ where: { id: 'outbox-dl' } });
    });

    it('moves invalid payload (missing type) to dead-letter', async () => {
      const mockRow = {
        id: 'outbox-invalid',
        queue: 'content-hydration',
        payload: { payload: { jobId: 'hyd-999' } },
        meta: null,
        attempts: 0,
        createdAt: new Date(),
      };

      (prisma.outbox.findMany as jest.Mock).mockResolvedValue([mockRow]);
      (prisma.outboxDeadLetter.create as jest.Mock).mockResolvedValue({});
      (prisma.outbox.delete as jest.Mock).mockResolvedValue({});
      (prisma.$transaction as jest.Mock).mockImplementation((arg: unknown) =>
        Array.isArray(arg) ? Promise.all(arg as Promise<unknown>[]) : (arg as () => Promise<unknown>)()
      );

      const count = await dispatchBatch();

      expect(count).toBe(0);
      expect(prisma.outboxDeadLetter.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deadLetterReason: 'missing_payload_type',
          originalOutboxId: 'outbox-invalid',
        }),
      });
    });

    // ── meta.deliverAt scheduling (in-app, due-now semantics) ──────────────────
    it('dispatches rows with no meta (deliverAt missing => due now)', async () => {
      const mockRow = {
        id: 'outbox-nometa',
        payload: { type: 'SYLLABUS', payload: { jobId: 'hyd-1' } },
        meta: null,
        attempts: 0,
        createdAt: new Date(),
      };
      (prisma.outbox.findMany as jest.Mock).mockResolvedValue([mockRow]);
      (prisma.outbox.update as jest.Mock).mockResolvedValue({});

      const count = await dispatchBatch();

      expect(count).toBe(1);
      expect(prisma.outbox.update).toHaveBeenCalledWith({
        where: { id: 'outbox-nometa' },
        data: { sentAt: expect.any(Date), attempts: 1 },
      });
    });

    it('dispatches rows whose deliverAt is in the past (due now)', async () => {
      const mockRow = {
        id: 'outbox-past',
        payload: { type: 'SYLLABUS', payload: { jobId: 'hyd-2' } },
        meta: { deliverAt: new Date(Date.now() - 60_000).toISOString() },
        attempts: 0,
        createdAt: new Date(),
      };
      (prisma.outbox.findMany as jest.Mock).mockResolvedValue([mockRow]);
      (prisma.outbox.update as jest.Mock).mockResolvedValue({});

      const count = await dispatchBatch();

      expect(count).toBe(1);
      expect(prisma.outbox.update).toHaveBeenCalledWith({
        where: { id: 'outbox-past' },
        data: { sentAt: expect.any(Date), attempts: 1 },
      });
    });

    it('skips rows whose deliverAt is in the future (not due yet)', async () => {
      const mockRow = {
        id: 'outbox-future',
        payload: { type: 'SYLLABUS', payload: { jobId: 'hyd-3' } },
        meta: { deliverAt: new Date(Date.now() + 3_600_000).toISOString() },
        attempts: 0,
        createdAt: new Date(),
      };
      (prisma.outbox.findMany as jest.Mock).mockResolvedValue([mockRow]);
      (prisma.outbox.update as jest.Mock).mockResolvedValue({});

      const count = await dispatchBatch();

      expect(count).toBe(0);
      expect(prisma.outbox.update).not.toHaveBeenCalled();
    });
  });
});
