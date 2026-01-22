/**
 * FILE OBJECTIVE:
 * - DEPRECATED: Legacy entrypoint for questions hydration.
 * - Now a thin wrapper that enqueues a job via enqueueQuestionsHydration() instead of calling LLM directly.
 * - Per COPILOT RULES: Hydrators only enqueue jobs, NO AI calls allowed here.
 *
 * LINKED UNIT TEST:
 * - __tests__/hydrators/hydrateQuestions.test.ts
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

import { enqueueQuestionsHydration } from "@/lib/execution-pipeline/enqueueTopicHydration"
import { normalizeDifficulty, normalizeLanguage } from "@/lib/normalize"
import { logger } from "@/lib/logger"

const HYDRATION_DEBUG = process.env.HYDRATION_DEBUG === '1' || process.env.AI_CONTENT_DEBUG === '1'

/**
 * @deprecated Use `submitJob({ jobType: 'questions', entityType: 'TOPIC', entityId, payload: { language, difficulty } })`
 * or `enqueueQuestionsHydration({ topicId, language, difficulty })` directly instead.
 *
 * This function now only enqueues a hydration job. The actual LLM call and persistence
 * is handled by the worker (worker/services/questionsWorker.ts).
 */
export async function hydrateQuestions(
  topicId: string,
  difficulty: ReturnType<typeof normalizeDifficulty>,
  language: ReturnType<typeof normalizeLanguage>
): Promise<{ enqueued: boolean; jobId?: string; reason?: string }> {
  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] hydrateQuestions called (deprecated wrapper)', { topicId, difficulty, language })

  // Delegate to the proper enqueue function
  const result = await enqueueQuestionsHydration({ topicId, language, difficulty })

  if (HYDRATION_DEBUG) {
    logger.debug('[hydration][DEBUG] hydrateQuestions enqueue result', {
      topicId,
      difficulty,
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
