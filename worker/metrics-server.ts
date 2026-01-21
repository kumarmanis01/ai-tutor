/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-require-imports */
// `express` can be a dev-only dependency depending on deployment. Lazily
// require it so production builds do not fail when it's not present.
let express: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  express = require('express')
} catch {
  express = null
}

import client from 'prom-client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import fs from 'fs'
import path from 'path'

const register = client.register

// Basic metrics
const jobsSpawned = new client.Counter({ name: 'orchestrator_jobs_spawned_total', help: 'Total worker jobs spawned' })
const workersRunning = new client.Gauge({ name: 'orchestrator_workers_running', help: 'Currently running workers' })
// Counter for analytics job runs. Labels: status=SUCCESS|FAILED|SKIPPED
const analyticsJobRuns = new client.Counter({ name: 'analytics_job_runs_total', help: 'Total analytics job runs', labelNames: ['status'] as const })

export async function startMetricsServer(port = Number(process.env.ORCHESTRATOR_METRICS_PORT || 9090)) {
  if (!express) {
    logger.warn('[metrics] express not available, metrics server disabled')
    return
  }
  const app = express()

  app.get('/metrics', async (_req: any, res: any) => {
    try {
      res.set('Content-Type', register.contentType)
      res.end(await register.metrics())
    } catch (err) {
      res.status(500).end(String(err))
    }
  })

  app.get('/health', async (_req: any, res: any) => {
    try {
      const ROOT = path.resolve(process.cwd())
      const STATUS_FILE = path.join(ROOT, 'tmp', 'orchestrator.status.json')
      let orchestrator: any = null
      if (fs.existsSync(STATUS_FILE)) orchestrator = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'))

      const counts = await prisma.workerLifecycle.groupBy({ by: ['status'], _count: { status: true } })
      const map: Record<string, number> = {}
      for (const c of counts) map[c.status] = Number(c._count.status || 0)
      workersRunning.set(map['RUNNING'] ?? 0)

      res.json({ ok: true, orchestrator, workerCounts: map })
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) })
    }
  })

  app.listen(port, () => logger.info(`[metrics] listening on ${port}`))
}

export function incJobsSpawned() { jobsSpawned.inc() }
export function incAnalyticsJobRun(status: 'SUCCESS' | 'FAILED' | 'SKIPPED') {
  try {
    analyticsJobRuns.labels(status).inc()
    } catch (e) {
    // metrics are best-effort; do not throw
    logger.warn('[metrics] failed to increment analyticsJobRuns', e)
  }
}
