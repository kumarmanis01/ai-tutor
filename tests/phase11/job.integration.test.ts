/**
 * FILE OBJECTIVE:
 * - Integration test for Phase 11 job-style suggestion processing and idempotency.
 * - Requires a live DB connection; skips automatically when DATABASE_URL is absent.
 *
 * LINKED UNIT TEST:
 * - tests/phase11/job.integration.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | migrate seed/cleanup from analyticsSignal to analyticsEvent; add FILE OBJECTIVE header
 */

import { prisma } from '@/lib/prisma'
import net from 'net'
import { generateSuggestionsForSignal } from '@/insights/engine'
import { saveSuggestions } from '@/insights/store'
import { saveSuggestions } from '@/insights/store'

describe('Phase 11 — Job-style suggestion processing idempotency', () => {
  let SKIP = false
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      SKIP = true
      return
    }
    try {
      // quick TCP probe to DB host to fail fast if DB server unreachable
      const pingDb = (urlStr: string, timeout = 500) => new Promise<void>((resolve, reject) => {
        try {
          const u = new URL(urlStr)
          const host = u.hostname
          const port = Number(u.port) || 5432
          const socket = net.createConnection({ host, port })
          const onError = (err: any) => { socket.destroy(); reject(err) }
          const onTimeout = () => { socket.destroy(); reject(new Error('DB ping timeout')) }
          socket.setTimeout(timeout)
          socket.once('connect', () => { socket.destroy(); resolve() })
          socket.once('error', onError)
          socket.once('timeout', onTimeout)
        } catch (e) { reject(e) }
      })
      await pingDb(process.env.DATABASE_URL)
    } catch {
      SKIP = true
      return
    }

    // Clean slate
    await prisma.contentSuggestion.deleteMany().catch(() => {})
    await prisma.auditLog.deleteMany().catch(() => {})
    await prisma.analyticsEvent.deleteMany({ where: { eventType: { startsWith: 'signal.' } } }).catch(() => {})
  })

  afterAll(async () => {
    if (SKIP) return
    await prisma.contentSuggestion.deleteMany().catch(() => {})
    await prisma.auditLog.deleteMany().catch(() => {})
    await prisma.analyticsEvent.deleteMany({ where: { eventType: { startsWith: 'signal.' } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('processes all analytics signals into suggestions exactly once and audits creation', async () => {
    if (SKIP) return

    // 1) Seed N analytics signal events
    await prisma.analyticsEvent.create({
      data: {
        courseId: 'c1',
        eventType: 'signal.low_completion_rate',
        metadata: { type: 'LOW_COMPLETION_RATE', severity: 'CRITICAL', completionRate: 0.1 },
        createdAt: new Date(),
      },
    })
    await prisma.analyticsEvent.create({
      data: {
        courseId: 'c2',
        eventType: 'signal.low_completion_rate',
        metadata: { type: 'LOW_COMPLETION_RATE', severity: 'CRITICAL', completionRate: 0.05 },
        createdAt: new Date(),
      },
    })

    // Helper: run signal -> suggestion processing over all signals in DB
    async function generateSuggestionsForAllSignals() {
      const signals = await prisma.analyticsEvent.findMany({ where: { eventType: { startsWith: 'signal.' } } })
      for (const sig of signals) {
        // Translate DB enum signal types to Insight Engine expected types where needed
        // mapping used here: LOW_COMPLETION_RATE -> LOW_COMPLETION
        const signalType = (sig.metadata as any)?.type
        const engineSignal: any = {
          id: sig.id,
          type: signalType === 'LOW_COMPLETION_RATE' ? 'LOW_COMPLETION' : (signalType as any),
          courseId: sig.courseId,
          targetId: (sig.metadata && (sig.metadata as any).lessonId) || `lesson-${sig.id}`,
          metadata: sig.metadata ?? {},
          createdAt: sig.createdAt?.toISOString?.() ?? new Date().toISOString(),
        }
        const suggestions = generateSuggestionsForSignal(engineSignal as any)
        // attach sourceSignalId to enable idempotency
        const enriched = suggestions.map((s: any) => ({ ...s, sourceSignalId: sig.id }))
        await saveSuggestions(prisma as any, enriched as any)
      }
    }

    // Ensure empty before run
    await prisma.contentSuggestion.deleteMany().catch(() => {})
    await prisma.auditLog.deleteMany().catch(() => {})

    // First run
    const testStartTime = new Date()
    await generateSuggestionsForAllSignals()

    const allSuggestions = await prisma.contentSuggestion.findMany()
    expect(allSuggestions.length).toBe(2)
    const sourceIds = allSuggestions.map(s => s.sourceSignalId)
    expect(new Set(sourceIds).size).toBe(2)
    // Use suggestion IDs to scope audit queries to only rows created for
    // the suggestions produced in this test run. This is more robust than
    // relying on `action` or createdAt windows when running against shared DBs.
    const suggestionIds = allSuggestions.map(s => s.id)

    // Poll for SUGGESTION_CREATED audits (audit writes are non-blocking)
    const waitFor = async (checkFn: () => Promise<boolean>, timeout = 2000, interval = 50) => {
      const start = Date.now()
      while (Date.now() - start < timeout) {
        if (await checkFn()) return true
        await new Promise(r => setTimeout(r, interval))
      }
      return false
    }

    const foundAudit = await waitFor(async () => {
      const audits = await prisma.auditLog.findMany({ where: { targetEntity: 'ContentSuggestion', targetId: { in: suggestionIds } } })
      return audits.length >= suggestionIds.length
    }, 2000, 50)
    expect(foundAudit).toBe(true)

    const auditsAfterFirst = await prisma.auditLog.findMany({ where: { targetEntity: 'ContentSuggestion', targetId: { in: suggestionIds } } })

    // Second run (idempotency)
    await generateSuggestionsForAllSignals()

    const allSuggestionsAfter = await prisma.contentSuggestion.findMany()
    expect(allSuggestionsAfter.length).toBe(2)
    // ensure no duplicate sourceSignalId entries
    const ids = allSuggestionsAfter.map(s => s.sourceSignalId)
    expect(new Set(ids).size).toBe(2)

    const suggestionIdsAfter = allSuggestionsAfter.map(s => s.id)
    const auditsAfterSecond = await prisma.auditLog.findMany({ where: { targetEntity: 'ContentSuggestion', targetId: { in: suggestionIdsAfter } } })
    // No new CREATED audit rows for duplicated processing of same signals
    expect(auditsAfterSecond.length).toBeGreaterThanOrEqual(auditsAfterFirst.length)
    // Ensure we didn't create more suggestion-created audits than suggestions (basic guard)
    expect(auditsAfterSecond.length).toBeLessThanOrEqual(allSuggestionsAfter.length)
  }, 20000)
})
