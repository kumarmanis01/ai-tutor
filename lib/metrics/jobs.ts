/* Metrics helper for jobs (Phase 16.3)
 * Exposes:
 * - recordJobStart(name)
 * - recordJobSuccess(name, durationMs)
 * - recordJobFailure(name, error)
 *
 * Implementation: try to use `prom-client` if available, otherwise fall back
 * to a no-op backend. Uses dynamic import so this file doesn't hard-require
 * prom-client or logger at startup.
 */

let enabled = false
let jobRuns: any = null
let jobFailures: any = null
let jobDuration: any = null

// Try to initialize prom-client asynchronously; if unavailable, fall back
// to disabled metrics (functions below will no-op or emit lightweight logs).
import('prom-client')
  .then((clientModule) => {
    const client: any = (clientModule && (clientModule as any).default) || clientModule
    try {
      jobRuns = new client.Counter({ name: 'job_runs_total', help: 'Total job runs', labelNames: ['job'] })
      jobFailures = new client.Counter({ name: 'job_failures_total', help: 'Total job failures', labelNames: ['job'] })
      jobDuration = new client.Histogram({ name: 'job_duration_ms', help: 'Job duration ms', labelNames: ['job'], buckets: [50, 200, 500, 1000, 5000, 15000, 60000] })
      enabled = true
    } catch {
      enabled = false
    }
  })
  .catch(() => { enabled = false })

function fallbackLogDebug(msg: string) {
  import('@/lib/logger').then((m) => m.logger?.debug?.(msg)).catch(() => {})
}

function fallbackLogWarn(msg: string) {
  import('@/lib/logger').then((m) => m.logger?.warn?.(msg)).catch(() => {})
}

export function recordJobStart(name: string) {
  try {
    if (enabled && jobRuns) jobRuns.inc({ job: name })
    else fallbackLogDebug(`[metrics] job start: ${name}`)
  } catch (e) {
    fallbackLogWarn(`[metrics] recordJobStart failed: ${String(e)}`)
  }
}

export function recordJobSuccess(name: string, durationMs: number) {
  try {
    if (enabled && jobDuration) jobDuration.observe({ job: name }, durationMs)
    else fallbackLogDebug(`[metrics] job success: ${name} ${durationMs}ms`)
  } catch (e) {
    fallbackLogWarn(`[metrics] recordJobSuccess failed: ${String(e)}`)
  }
}

export function recordJobFailure(name: string, error: string) {
  try {
    if (enabled && jobFailures) jobFailures.inc({ job: name })
    else fallbackLogWarn(`[metrics] job failure: ${name} ${error}`)
  } catch (e) {
    fallbackLogWarn(`[metrics] recordJobFailure failed: ${String(e)}`)
  }
}

const metrics = { recordJobStart, recordJobSuccess, recordJobFailure }
export default metrics
