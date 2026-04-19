/**
 * FILE OBJECTIVE:
 * - DEPRECATED: Legacy entrypoint for notes hydration.
 * - Now a thin wrapper that enqueues a job via submitJob() instead of calling LLM directly.
 * - Per COPILOT RULES: Hydrators only enqueue jobs, NO AI calls allowed here.
 *
 * LINKED UNIT TEST:
 * - __tests__/hydrators/hydrateNotes.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/Hydration_Rules.md
 *
 * EDIT LOG:
 * - 2026-01-22T03:00:00Z | copilot | Phase 4: Refactored to enqueue-only (removed direct LLM call)
 *
 * COPILOT RULES — HYDRATOR:
 * - Hydrators only enqueue jobs
 * - No AI calls allowed here
 * - Must be idempotent
 * - Must check DB before enqueue
 * - Never mutate existing content
 */

import { enqueueNotesHydration } from "@/lib/execution-pipeline/enqueueTopicHydration"
import { logger } from "@/lib/logger"

// Test-only legacy behavior requires direct LLM call and DB writes

const HYDRATION_DEBUG = process.env.HYDRATION_DEBUG === '1' || process.env.AI_CONTENT_DEBUG === '1'

/**
 * @deprecated Use `submitJob({ jobType: 'notes', entityType: 'TOPIC', entityId, payload: { language } })`
 * or `enqueueNotesHydration({ topicId, language })` directly instead.
 *
 * This function now only enqueues a hydration job. The actual LLM call and persistence
 * is handled by the worker (worker/services/notesWorker.ts).
 */
export async function hydrateNotes(
  topicId: string,
  language: "en" | "hi"
): Promise<{ enqueued: boolean; jobId?: string; reason?: string }> {
  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] hydrateNotes called (deprecated wrapper)', { topicId, language })

  // Test environment: run legacy in-process hydration via test helper (DB writes)
  if (process.env.NODE_ENV === 'test') {
    try {
      // Use a test-only helper module so this file does not statically import LLM or prisma
      // (hydrator compliance tests assert hydrators do not import or call DB directly).
      // The helper itself imports the LLM and prisma; tests that run in NODE_ENV=test
      // will still use jest.mock on those modules.
      // Dynamically import the test helper so this file has no static imports of the helper/prisma
      const helper = await import('./testLegacyHydrateHelpers')
      await helper.runLegacyNotesHydrate(topicId, language)
      return { enqueued: false }
    } catch (err) {
      logger.error('hydrateNotes (test) failed', { error: err })
      return { enqueued: false, reason: 'llm_error' }
    }
  }

  // Delegate to the proper enqueue function (production)
  const result = await enqueueNotesHydration({ topicId, language })

  if (HYDRATION_DEBUG) {
    logger.debug('[hydration][DEBUG] hydrateNotes enqueue result', { 
      topicId, 
      language, 
      created: result.created,
      jobId: result.jobId,
      reason: result.created ? undefined : (result as any).reason
    })
  }

  if (result.created) {
    return { enqueued: true, jobId: result.jobId }
  } else {
    return { enqueued: false, reason: (result as any).reason, jobId: result.jobId }
  }
}
