/**
 * FILE OBJECTIVE:
 * - Tests for the deprecated hydrateNotes wrapper function.
 * - Verifies it properly delegates to enqueueNotesHydration.
 *
 * LINKED UNIT TEST:
 * - This file tests: hydrators/hydrateNotes.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-01-22T03:10:00Z | copilot | Phase 4: Updated tests for enqueue-only behavior
 */

import { hydrateNotes } from '../../hydrators/hydrateNotes'

// Mock the enqueue function
jest.mock('@/lib/execution-pipeline/enqueueTopicHydration', () => ({
  enqueueNotesHydration: jest.fn()
}))

import { enqueueNotesHydration } from '@/lib/execution-pipeline/enqueueTopicHydration'

const mockEnqueue = enqueueNotesHydration as jest.Mock

describe('hydrateNotes (deprecated wrapper)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('delegates to enqueueNotesHydration and returns success', async () => {
    mockEnqueue.mockResolvedValue({ created: true, jobId: 'job-123' })

    const result = await hydrateNotes('topic-abc', 'en')

    expect(mockEnqueue).toHaveBeenCalledWith({ topicId: 'topic-abc', language: 'en' })
    expect(result).toEqual({ enqueued: true, jobId: 'job-123' })
  })

  test('returns reason when enqueue fails', async () => {
    mockEnqueue.mockResolvedValue({ created: false, reason: 'content_exists', jobId: 'existing-job' })

    const result = await hydrateNotes('topic-abc', 'hi')

    expect(mockEnqueue).toHaveBeenCalledWith({ topicId: 'topic-abc', language: 'hi' })
    expect(result).toEqual({ enqueued: false, reason: 'content_exists', jobId: 'existing-job' })
  })

  test('handles topic not found', async () => {
    mockEnqueue.mockResolvedValue({ created: false, reason: 'resolve_not_found' })

    const result = await hydrateNotes('missing-topic', 'en')

    expect(result).toEqual({ enqueued: false, reason: 'resolve_not_found', jobId: undefined })
  })
})
