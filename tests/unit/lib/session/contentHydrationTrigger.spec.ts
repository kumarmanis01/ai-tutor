/**
 * FILE OBJECTIVE:
 * - Verify the topic hydration trigger enqueues exactly one questions job per topic.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/session/contentHydrationTrigger.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add regression coverage for single-job questions hydration trigger
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockEnqueueNotesHydration = jest.fn(async () => ({ created: true, jobId: 'notes-job' }));
const mockEnqueueQuestionsHydration = jest.fn(async () => ({ created: true, jobId: 'questions-job' }));
const mockEnqueueTestsHydration = jest.fn(async () => ({ created: true, jobId: 'tests-job' }));
const mockLogger = { info: jest.fn(), error: jest.fn() };

jest.mock('@/lib/execution-pipeline/enqueueTopicHydration', () => ({
  enqueueNotesHydration: mockEnqueueNotesHydration,
  enqueueQuestionsHydration: mockEnqueueQuestionsHydration,
  enqueueTestsHydration: mockEnqueueTestsHydration,
}));

jest.mock('@/lib/logger', () => ({ logger: mockLogger }));

describe('contentHydrationTrigger.triggerForTopic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enqueues one questions hydration job for a topic trigger', async () => {
    const { triggerForTopic } = await import('@/lib/session/contentHydrationTrigger');

    triggerForTopic('topic-1');
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockEnqueueNotesHydration).toHaveBeenCalledTimes(1);
    expect(mockEnqueueQuestionsHydration).toHaveBeenCalledTimes(1);
    expect(mockEnqueueQuestionsHydration).toHaveBeenCalledWith({
      topicId: 'topic-1',
      language: 'en',
      difficulty: 'medium',
    });
    expect(mockEnqueueTestsHydration).toHaveBeenCalledTimes(1);
  });
});
