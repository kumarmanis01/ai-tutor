import { listJobs, JobDefinition } from '@/lib/jobs/registry'
import logAuditEvent from '@/lib/audit/log'
import { prisma } from '@/lib/prisma'
import { recordJobStart, recordJobSuccess, recordJobFailure } from '@/lib/metrics/jobs'

function stringToIntLock(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return (h & 0xffffffff) >>> 0
}

/**
 * Run a JobDefinition with Postgres advisory lock and timeout.
 * - Acquires pg_try_advisory_lock(lockId)
 * - Enforces timeout via Promise.race
 * - Emits structured audit events for START/SUCCESS/FAILED
 * - Releases advisory lock in finally
 *
 * If lock is not acquired, returns { skipped: true }.
 * If job.run() throws, the error is rethrown after logging (not swallowed).
 */
export async function runJob(job: JobDefinition): Promise<{ skipped?: true; durationMs?: number } | void> {
  if (!job) throw new Error('runJob: missing job')

  const lockId = stringToIntLock(job.lockKey)

  // Try to acquire advisory lock
  let acquired = false
  try {
    const res: any = await (prisma as any).$queryRawUnsafe(`SELECT pg_try_advisory_lock(${lockId}) as acquired`)
    if (Array.isArray(res) && res.length > 0) acquired = !!res[0].acquired
    else if (res && typeof res.acquired !== 'undefined') acquired = !!res.acquired
  } catch (err: any) {
    throw new Error(`runJob: failed to acquire advisory lock: ${String((err as any)?.message ?? err)}`)
  }

  const start = Date.now()
  if (!acquired) {
    logAuditEvent(prisma, { action: 'JOB_RUN', metadata: { job: job.name, status: 'SKIPPED', reason: 'lock_unavailable' } })
    return { skipped: true, durationMs: Date.now() - start }
  }

  // START audit + metrics
  logAuditEvent(prisma, { action: 'JOB_RUN', metadata: { job: job.name, status: 'STARTED', timestamp: new Date().toISOString() } })
  try { recordJobStart(job.name) } catch {}

  try {
    if (process.env.JOB_DRY_RUN === '1') {
      try { const logger = (await import('@/lib/logger')).logger; logger?.info?.('job-runner: dry-run', { job: job.name }) } catch {}
      logAuditEvent(prisma, { action: 'JOB_RUN', metadata: { job: job.name, status: 'DRY_RUN' } })
      return
    }

    const timeoutMs = job.timeoutMs || 1000 * 60 * 30
    await Promise.race([
      job.run(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
    ])

    const durationMs = Date.now() - start
    logAuditEvent(prisma, { action: 'JOB_RUN', metadata: { job: job.name, status: 'SUCCESS', durationMs } })
    try { recordJobSuccess(job.name, durationMs) } catch {}
    return
  } catch (err: any) {
    const durationMs = Date.now() - start
    const message = String(err?.message ?? err)
    logAuditEvent(prisma, { action: 'JOB_RUN', metadata: { job: job.name, status: message === 'timeout' ? 'TIMED_OUT' : 'FAILED', error: message, durationMs } })
    try { recordJobFailure(job.name, message) } catch {}
    // Emit an alert for job failures (best-effort; router handles dedupe/rate-limit)
    try {
      const router = (global as any).alertRouter
      if (router && typeof router.route === 'function') {
        const severity = message === 'timeout' ? 'critical' : 'error'
        await router.route({ title: `JOB_FAILED: ${job.name}`, message: message, severity, timestamp: new Date().toISOString() })
      }
    } catch (e) {
      try { const logger = (await import('@/lib/logger')).logger; logger?.warn?.('job-runner: alert routing failed', { job: job.name, err: String(e) }) } catch {}
    }
    throw err
  } finally {
    try {
      await (prisma as any).$executeRawUnsafe(`SELECT pg_advisory_unlock(${lockId})`)
    } catch (e) {
      try { const logger = (await import('@/lib/logger')).logger; logger?.warn?.('job-runner: failed to release advisory lock', { job: job.name, err: String(e) }) } catch {}
    }
  }
}

export async function runAllRegistered(): Promise<Record<string, { skipped?: true } | void>> {
  const entries = listJobs()
  const out: Record<string, { skipped?: true } | void> = {}
  for (const j of entries) {
    try {
      out[j.name] = await runJob(j)
    } catch {
      out[j.name] = { skipped: false as any }
    }
  }
  return out
}

const runner = { runJob, runAllRegistered }
export default runner
