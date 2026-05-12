/**
 * FILE OBJECTIVE:
 * - Validate proactive PRACTICE hydration behavior in startSession() when question bank is empty.
 *
 * LINKED UNIT TEST:
 * - tests/unit/session/sessionEngine.startSession.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-08T00:00:00Z | copilot | add regression tests for proactive question hydration on session start/resume
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    structuredSession: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    question: {
      count: jest.fn(),
    },
    learningSession: {
      create: jest.fn().mockResolvedValue({ id: 'ls-1' }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/session/contentReadinessService', () => ({
  contentReadinessService: {
    isTopicReady: jest.fn(),
  },
}));

const mockContentHydrationTrigger = jest.fn();
jest.mock('@/lib/session/contentHydrationTrigger', () => ({
  contentHydrationTrigger: {
    triggerForTopic: mockContentHydrationTrigger,
  },
}));

jest.mock('@/lib/execution-pipeline/enqueueTopicHydration', () => ({
  enqueueQuestionsHydration: jest.fn(),
}));

jest.mock('@/lib/session/homework', () => ({
  generateHomework: jest.fn(),
}));

jest.mock('@/lib/session/transitionSessionPhase', () => ({
  transitionSessionPhase: jest.fn(),
  InvalidTransitionError: class InvalidTransitionError extends Error {
    status = 400;
  },
}));

jest.mock('@/lib/session/phaseCompletionValidator', () => ({
  validatePhaseCompletion: jest.fn(),
}));

jest.mock('@/lib/learning/updateTopicProgress', () => ({
  updateStudentTopicProgress: jest.fn(),
}));

jest.mock('@/lib/events/domainEvents', () => ({
  emitSessionCompleted: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { contentReadinessService } from '@/lib/session/contentReadinessService';
import { enqueueQuestionsHydration } from '@/lib/execution-pipeline/enqueueTopicHydration';
import { startSession } from '@/lib/session/sessionEngine';

const STUDENT_ID = 'student-1';
const TOPIC_ID = 'topic-1';

const sessionWithTopic = {
  id: 'session-1',
  studentId: STUDENT_ID,
  topicId: TOPIC_ID,
  state: 'OVERVIEW',
  meta: {},
  startedAt: new Date(),
  completedAt: null,
  topic: {
    name: 'Natural Numbers',
    chapter: { name: 'Number System', subject: { name: 'Mathematics' } },
  },
};

describe('startSession proactive practice hydration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (contentReadinessService.isTopicReady as jest.Mock).mockResolvedValue({
      status: 'READY',
      hasNotes: true,
      hasPracticeQuestions: true,
      hasTestQuestions: true,
    });
    (enqueueQuestionsHydration as jest.Mock).mockResolvedValue({
      created: true,
      jobId: 'hydration-1',
    });
  });

  it('enqueues questions hydration with 10 requested questions when creating a new session and active bank is empty', async () => {
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.structuredSession.create as jest.Mock).mockResolvedValue(sessionWithTopic);
    (prisma.question.count as jest.Mock).mockResolvedValue(0);

    await startSession(STUDENT_ID, TOPIC_ID);
    await Promise.resolve();

    expect(enqueueQuestionsHydration).toHaveBeenCalledWith({
      topicId: TOPIC_ID,
      language: 'en',
      difficulty: 'medium',
      force: true,
      questionsPerDifficulty: 10,
    });
  });

  it('enqueues questions hydration on resume when active bank is empty', async () => {
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(sessionWithTopic);
    (prisma.question.count as jest.Mock).mockResolvedValue(0);

    await startSession(STUDENT_ID, TOPIC_ID);
    await Promise.resolve();

    expect(enqueueQuestionsHydration).toHaveBeenCalledWith({
      topicId: TOPIC_ID,
      language: 'en',
      difficulty: 'medium',
      force: true,
      questionsPerDifficulty: 10,
    });
  });

  it('does not enqueue questions hydration when active practice questions already exist', async () => {
    (prisma.structuredSession.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.structuredSession.create as jest.Mock).mockResolvedValue(sessionWithTopic);
    (prisma.question.count as jest.Mock).mockResolvedValue(5);

    await startSession(STUDENT_ID, TOPIC_ID);
    await Promise.resolve();

    expect(enqueueQuestionsHydration).not.toHaveBeenCalled();
  });
});
