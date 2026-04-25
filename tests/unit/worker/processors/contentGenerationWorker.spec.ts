/**
 * FILE OBJECTIVE:
 * - Unit tests for worker/processors/contentGenerationWorker.ts —
 *   BullMQ worker for AI content generation (happy path + error paths).
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created — B4.1 content generation worker tests
 */

// ── Phase-2 TODO ──────────────────────────────────────────────────────────────
// Full worker processor tests require mocking OpenAI streaming responses and
// BullMQ Job objects. These are tracked in post_launch_backlog.md under
// "B4.1 — ContentGenerationWorker full integration tests".

import {
  CONTENT_GENERATION_QUEUE,
  getContentGenerationWorker,
} from '@/worker/processors/contentGenerationWorker';

// Mock all heavy dependencies
jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  })),
}));

jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn().mockReturnValue({
    set: jest.fn(),
    publish: jest.fn(),
    expire: jest.fn(),
  }),
  getSharedConnection: jest.fn().mockReturnValue({}),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    generationJob: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    content: {
      create: jest.fn(),
    },
  },
}));

jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
}));

import { Worker } from 'bullmq';
const MockWorker = Worker as jest.MockedClass<typeof Worker>;

describe('worker/processors/contentGenerationWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Constants ──────────────────────────────────────────────────────────────

  describe('CONTENT_GENERATION_QUEUE', () => {
    it('should be the string "content-generation"', () => {
      expect(CONTENT_GENERATION_QUEUE).toBe('content-generation');
    });
  });

  // ── getContentGenerationWorker ─────────────────────────────────────────────

  describe('getContentGenerationWorker', () => {
    it('should return a Worker instance', () => {
      const worker = getContentGenerationWorker();
      expect(worker).toBeDefined();
      expect(MockWorker).toHaveBeenCalledTimes(1);
    });

    it('should be a singleton — same instance on second call', () => {
      const w1 = getContentGenerationWorker();
      const w2 = getContentGenerationWorker();
      expect(w1).toBe(w2);
      // Worker constructor should only be called once
      expect(MockWorker).toHaveBeenCalledTimes(1);
    });

    it('should configure Worker with correct queue name', () => {
      getContentGenerationWorker();
      const firstCallArgs = MockWorker.mock.calls[0];
      expect(firstCallArgs[0]).toBe(CONTENT_GENERATION_QUEUE);
    });
  });

  // TODO Phase-2: Test the processor function logic directly by calling it
  // with a mock Job. Requires OpenAI streaming mock.
  // Tracked in post_launch_backlog.md — "B4.1 processContentGenerationJob tests".
  describe('processContentGenerationJob (processor fn)', () => {
    it.todo('should update job status to PROCESSING at start');
    it.todo('should store partial content in Redis every 5 chunks');
    it.todo('should publish partial events to pub/sub channel');
    it.todo('should create Content record with PENDING_REVIEW status');
    it.todo('should update GenerationJob to COMPLETED with contentId');
    it.todo('should throw and update job to FAILED when OpenAI errors');
    it.todo('should throw when Redis is unavailable');
  });
});
