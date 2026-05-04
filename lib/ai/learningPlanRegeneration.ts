/**
 * FILE OBJECTIVE:
 * - Provide a guarded, non-blocking learning-plan regeneration entry point with
 *   per-student+subject deduplication to prevent overlapping regenerate flows.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/learningPlanRegeneration.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - /.github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-04T00:00:00Z | copilot | add regeneration dedup lock helper for API-triggered background plan generation
 */

import { generateLearningPlan } from '@/lib/ai/learningPlan'
import { logger } from '@/lib/logger'
import { getRedis } from '@/lib/redis'

const REGEN_LOCK_TTL_SECONDS = 120
const localLocks = new Map<string, { expiresAt: number; token: string }>()

type GuardedRegenParams = {
  studentId: string
  subjectId: string
  weeklyGoal: number
  examDate?: Date
  routeName: string
  methodName: string
}

type AcquiredLock = {
  key: string
  token: string
  hasRedisLock: boolean
}

function buildLockKey(studentId: string, subjectId: string): string {
  return `learning-plan:regen:lock:${studentId}:${subjectId}`
}

async function tryAcquireLock(studentId: string, subjectId: string): Promise<AcquiredLock | null> {
  const key = buildLockKey(studentId, subjectId)
  const now = Date.now()
  const existing = localLocks.get(key)
  if (existing && existing.expiresAt > now) {
    return null
  }

  const token = `${process.pid}:${now}:${Math.random().toString(36).slice(2)}`
  localLocks.set(key, { token, expiresAt: now + REGEN_LOCK_TTL_SECONDS * 1000 })

  const redis = getRedis()
  if (!redis) {
    return { key, token, hasRedisLock: false }
  }

  try {
    const lockResult = await redis.set(key, token, 'EX', REGEN_LOCK_TTL_SECONDS, 'NX')
    if (lockResult !== 'OK') {
      localLocks.delete(key)
      return null
    }
    return { key, token, hasRedisLock: true }
  } catch (err) {
    localLocks.delete(key)
    logger.warn('[learning-plan/regeneration] lock acquisition failed', {
      className: 'LearningPlanRegenerationGuard',
      methodName: 'tryAcquireLock',
      key,
      error: String((err as Error)?.message ?? err),
    })
    return null
  }
}

async function releaseLock(lock: AcquiredLock): Promise<void> {
  localLocks.delete(lock.key)
  if (!lock.hasRedisLock) return

  const redis = getRedis()
  if (!redis) return
  try {
    const current = await redis.get(lock.key)
    if (current === lock.token) {
      await redis.del(lock.key)
    }
  } catch {
    // Best-effort cleanup only.
  }
}

export async function enqueueLearningPlanRegeneration(params: GuardedRegenParams): Promise<boolean> {
  const lock = await tryAcquireLock(params.studentId, params.subjectId)
  if (!lock) {
    logger.info('[learning-plan/regeneration] skipped duplicate regeneration', {
      className: params.routeName,
      methodName: params.methodName,
      studentId: params.studentId,
      subjectId: params.subjectId,
    })
    return false
  }

  generateLearningPlan(params.studentId, params.subjectId, {
    examDate: params.examDate,
    weeklyGoal: params.weeklyGoal,
  })
    .catch((err) => {
      logger.warn('[learning-plan/regeneration] regeneration failed', {
        className: params.routeName,
        methodName: params.methodName,
        studentId: params.studentId,
        subjectId: params.subjectId,
        error: String((err as Error)?.message ?? err),
      })
    })
    .finally(async () => {
      await releaseLock(lock)
    })

  return true
}

export const __testOnly = {
  clearLocalLocks: (): void => {
    localLocks.clear()
  },
}
