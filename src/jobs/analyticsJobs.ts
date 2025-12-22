/**
 * Server-side job runner for analytics aggregation and signals.
 * - Calls analytics aggregator first, then signal generator
 * - Measures duration, logs errors, and returns structured result
 * - Does not import Prisma directly
 */
import { acquireJobLock, releaseJobLock } from './jobLock'
import logAuditEvent from '@/lib/audit/log'
import { prisma } from '@/lib/prisma'

export async function runAnalyticsJobs(): Promise<{ success: boolean; durationMs: number; error?: string; skipped?: boolean; reason?: string }> {
  const started = Date.now()
  let success = true
  let accumulatedError: string | undefined
  let lockAcquired = false

  try {
    // Acquire non-overlapping job lock (30 minutes TTL)
    const lock = await acquireJobLock('analytics_jobs', 30 * 60 * 1000)
    if ((lock as any).skipped) {
      // Record audit log for skipped run
      logAuditEvent(prisma, {
        action: 'ANALYTICS_JOB_RUN',
        metadata: { status: 'SKIPPED', reason: (lock as any).reason ?? 'locked' }
      })
      const durationMs = Date.now() - started
      return { success: false, durationMs, error: String((lock as any).reason ?? 'locked'), skipped: true, reason: (lock as any).reason }
    }
    lockAcquired = true

    // 1) Run analytics aggregation (preferred API: runForAllCourses)
    try {
      const agg: any = await import('@/workers/analyticsAggregator')
        if (typeof agg.runForAllCourses === 'function') {
          await agg.runForAllCourses()
        } else {
          // Preferred method not available — log and skip to avoid guessing semantics
          try { (await import('@/lib/logger')).logger?.warn?.('analyticsAggregator.runForAllCourses not found; skipping aggregation step') } catch {}
        }
    } catch (e) {
      success = false
      const msg = `analytics aggregation failed: ${String(e)}`
      accumulatedError = accumulatedError ? `${accumulatedError}; ${msg}` : msg
      try {
        const logger = (await import('@/lib/logger')).logger
        logger?.error?.(msg, { error: (e as Error)?.message ?? String(e) })
      } catch {}
    }

    // 2) Generate rule-based signals for courses
    try {
      const signals: any = await import('@/workers/generateSignals')
      if (typeof signals.generateSignalsForAllCourses === 'function') {
        await signals.generateSignalsForAllCourses()
      } else {
        try { (await import('@/lib/logger')).logger?.warn?.('generateSignalsForAllCourses not found; skipping signals generation') } catch {}
      }
    } catch (e) {
      success = false
      const msg = `signals generation failed: ${String(e)}`
      accumulatedError = accumulatedError ? `${accumulatedError}; ${msg}` : msg
      try {
        const logger = (await import('@/lib/logger')).logger
        logger?.error?.(msg, { error: (e as Error)?.message ?? String(e) })
      } catch {}
    }
  } catch (outer) {
    // Catch any unexpected error to avoid throwing from job runner
    success = false
    const msg = `unexpected failure in runAnalyticsJobs: ${String(outer)}`
    accumulatedError = accumulatedError ? `${accumulatedError}; ${msg}` : msg
    try {
      const logger = (await import('@/lib/logger')).logger
      logger?.error?.(msg, { error: (outer as Error)?.message ?? String(outer) })
    } catch {}
  }

  const durationMs = Date.now() - started

  // Write audit log (non-blocking)
  try {
    logAuditEvent(prisma, {
      action: 'ANALYTICS_JOB_RUN',
      metadata: { status: success ? 'SUCCESS' : 'FAILED', durationMs, error: accumulatedError ?? null }
    })
  } catch (e) {
    try {
      const logger = (await import('@/lib/logger')).logger
      logger?.warn?.('Failed to enqueue audit log for analytics job', { error: (e as Error)?.message ?? String(e) })
    } catch {}
  }

  // Minimal observability: increment metrics counter if available.
  // TODO: wire alerting (slack/email) for repeated failures or long durations.
  try {
    const metrics = await import('@/worker/metrics-server')
    if (metrics && typeof metrics.incAnalyticsJobRun === 'function') {
      const statusLabel = success ? 'SUCCESS' : 'FAILED'
      metrics.incAnalyticsJobRun(statusLabel)
    }
  } catch (e) {
    try {
      const logger = (await import('@/lib/logger')).logger
      logger?.warn?.('Failed to increment analytics job metric', { error: (e as Error)?.message ?? String(e) })
    } catch {}
  }

  // Release lock if acquired
  if (lockAcquired) {
    try { await releaseJobLock('analytics_jobs') } catch {}
  }

  return { success, durationMs, error: accumulatedError }
}

export default runAnalyticsJobs
