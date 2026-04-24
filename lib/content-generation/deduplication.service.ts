/**
 * FILE OBJECTIVE:
 * - Deduplication service for AI content generation requests. Merges duplicate
 *   requests for the same topic within a 15-minute window to avoid redundant
 *   OpenAI API calls and wasted cost.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/content-generation/deduplication.service.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created — B4.2 content generation deduplication
 */

import { getRedis } from '@/lib/redis'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

// ── Constants ─────────────────────────────────────────────────────────────────

/** 15-minute dedup window in seconds */
const DEDUP_TTL_SECONDS = 900

// ── Key helpers ────────────────────────────────────────────────────────────────

function dedupKey(normalizedTopic: string): string {
  return `content_gen:dedup:${normalizedTopic}`
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Normalize a topic string for deduplication.
 * Lowercases, removes special characters, and replaces spaces with hyphens.
 */
export function normalizeTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/**
 * Check for an existing in-progress or completed GenerationJob for the same topic.
 * Returns the existing jobId if found in Redis cache, otherwise null.
 */
export async function checkDedup(normalizedTopic: string): Promise<string | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const existingJobId = await redis.get(dedupKey(normalizedTopic))
    return existingJobId
  } catch (err: unknown) {
    logger.error('Dedup check failed', { normalizedTopic, error: err })
    return null
  }
}

/**
 * Register a new jobId in the dedup cache with 15-minute TTL.
 * Called immediately after creating a new GenerationJob.
 */
export async function setDedup(normalizedTopic: string, jobId: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(dedupKey(normalizedTopic), jobId, 'EX', DEDUP_TTL_SECONDS)
  } catch (err: unknown) {
    logger.error('Dedup set failed', { normalizedTopic, jobId, error: err })
    // Non-fatal: generation continues even if dedup cache write fails
  }
}

/**
 * Add a subscriber (student) to an existing GenerationJob.
 * Called when a duplicate request is detected for a PENDING/PROCESSING job.
 */
export async function addSubscriber(jobId: string, studentId: string): Promise<void> {
  try {
    const existing = await prisma.generationJob.findUnique({
      where: { id: jobId },
      select: { subscriberIds: true },
    })

    if (!existing) {
      logger.warn('addSubscriber: job not found', { jobId, studentId })
      return
    }

    if (existing.subscriberIds.includes(studentId)) {
      // Already subscribed — idempotent
      return
    }

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { subscriberIds: { push: studentId } },
    })

    logger.info('Subscriber added to generation job', { jobId, studentId })
  } catch (err: unknown) {
    logger.error('addSubscriber failed', { jobId, studentId, error: err })
  }
}
