import { registerJob } from '@/lib/jobs/registry'

// Analytics job wrapper
registerJob({
  name: 'analytics_jobs',
  lockKey: 'analytics_jobs',
  timeoutMs: 30 * 60 * 1000,
  schedule: { type: 'interval', everySec: 60 * 30 },
  run: async () => {
    // import at runtime to keep startup fast and for test injection
    const job = await import('@/jobs/analyticsJobs')
    if (typeof job.runAnalyticsJobs === 'function') {
      await job.runAnalyticsJobs()
      return
    }
    if (typeof job.default === 'function') {
      await job.default()
    }
  },
})

// Generate signals job
registerJob({
  name: 'generate_signals',
  lockKey: 'generate_signals',
  timeoutMs: 30 * 60 * 1000,
  schedule: { type: 'interval', everySec: 60 * 30 },
  run: async () => {
    const g = await import('@/worker/services/generateSignals')
    if (typeof g.generateSignalsForAllCourses === 'function') {
      await g.generateSignalsForAllCourses()
    }
  },
})

// Suggestions job: convert recent signals into suggestions (idempotent)
registerJob({
  name: 'generate_suggestions',
  lockKey: 'generate_suggestions',
  timeoutMs: 30 * 60 * 1000,
  schedule: { type: 'interval', everySec: 60 * 30 },
  run: async () => {
    const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma
    const engine = await import('@/insights/engine')
    const store = await import('@/insights/store')
    // look back last hour by default
    const since = new Date(Date.now() - 1000 * 60 * 60)
    const signals = await (db as any).analyticsSignal.findMany({ where: { createdAt: { gte: since } } })
    for (const s of signals) {
      try {
        const suggestions = engine.generateSuggestionsForSignal(s as any)
        const enriched = suggestions.map((x: any) => ({ ...x, sourceSignalId: s.id }))
        await store.saveSuggestions(db, enriched as any)
      } catch {
        // best-effort
      }
    }
  },
})

// Regeneration worker: drain pending regeneration jobs
registerJob({
  name: 'regeneration_worker',
  lockKey: 'regeneration_worker',
  timeoutMs: 10 * 60 * 1000,
  schedule: { type: 'interval', everySec: 60 },
  run: async () => {
    const worker = await import('@/worker/processors/regenerationWorker')
    if (typeof worker.processNextJob === 'function') {
      // keep processing until no pending job or until timeout (worker's own logic will limit)
      while (true) {
        const res = await worker.processNextJob()
        if (!res) break
      }
    } else if (typeof worker.startWorker === 'function') {
      // fallback: start worker briefly
      const h = worker.startWorker({ intervalMs: 100 })
      // run for a short burst
      await new Promise((r) => setTimeout(r, 2000))
      try { await h.stop() } catch {}
    }
  },
})

// module intentionally has no runtime export; importing it registers jobs
export const __jobs_registered = true
