/**
 * FILE OBJECTIVE:
 * - Tests for the deprecated hydrateQuestions wrapper function.
 * - Verifies it properly delegates to enqueueQuestionsHydration.
 *
 * LINKED UNIT TEST:
 * - This file tests: hydrators/hydrateQuestions.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-01-22T03:10:00Z | copilot | Phase 4: Updated tests for enqueue-only behavior
 */

import { hydrateQuestions } from '../../hydrators/hydrateQuestions'

// Mock the enqueue function
jest.mock('@/lib/execution-pipeline/enqueueTopicHydration', () => ({
  enqueueQuestionsHydration: jest.fn()
}))

import { enqueueQuestionsHydration } from '@/lib/execution-pipeline/enqueueTopicHydration'

const mockEnqueue = enqueueQuestionsHydration as jest.Mock

describe('hydrateQuestions (deprecated wrapper)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('delegates to enqueueQuestionsHydration and returns success', async () => {
    mockEnqueue.mockResolvedValue({ created: true, jobId: 'job-456' })

    // Function signature: (topicId, difficulty, language)
    // Enqueue receives: { topicId, language, difficulty }
    const result = await hydrateQuestions('topic-abc', 'medium' as any, 'en' as any)

    expect(mockEnqueue).toHaveBeenCalledWith({ topicId: 'topic-abc', language: 'en', difficulty: 'medium' })
    expect(result).toEqual({ enqueued: true, jobId: 'job-456' })
  })

  test('returns reason when enqueue fails', async () => {
    mockEnqueue.mockResolvedValue({ created: false, reason: 'content_exists', jobId: 'existing-job' })

    const result = await hydrateQuestions('topic-abc', 'easy' as any, 'hi' as any)

    expect(mockEnqueue).toHaveBeenCalledWith({ topicId: 'topic-abc', language: 'hi', difficulty: 'easy' })
    expect(result).toEqual({ enqueued: false, reason: 'content_exists', jobId: 'existing-job' })
  })

  test('handles topic not found', async () => {
    mockEnqueue.mockResolvedValue({ created: false, reason: 'resolve_not_found' })

    const result = await hydrateQuestions('missing-topic', 'hard' as any, 'en' as any)

    expect(result).toEqual({ enqueued: false, reason: 'resolve_not_found', jobId: undefined })
  })

  test('handles job already queued', async () => {
    mockEnqueue.mockResolvedValue({ created: false, reason: 'job_already_queued', jobId: 'existing-job' })

    const result = await hydrateQuestions('topic-abc', 'medium' as any, 'en' as any)

    expect(result).toEqual({ enqueued: false, reason: 'job_already_queued', jobId: 'existing-job' })
  })
})
