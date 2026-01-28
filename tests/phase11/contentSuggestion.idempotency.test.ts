import { prisma } from '@/lib/prisma'
import net from 'net'
import { generateSuggestionsForSignal } from '@/insights/engine'
import { saveSuggestions } from '@/insights/store'

describe('Phase 11 — ContentSuggestion idempotency', () => {
  let SKIP_TEST = false
  beforeAll(async () => {
    // If DATABASE_URL is not set or DB unreachable, skip the test gracefully.
    if (!process.env.DATABASE_URL) {
      // eslint-disable-next-line no-console
      console.warn('Skipping Phase 11 idempotency test: DATABASE_URL not set')
      SKIP_TEST = true
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
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Skipping Phase 11 idempotency test: DB not reachable', String(e))
      SKIP_TEST = true
      return
    }

    // ensure clean slate
    await prisma.contentSuggestion.deleteMany().catch(() => {})
    await prisma.auditLog.deleteMany().catch(() => {})
    await prisma.analyticsSignal.deleteMany().catch(() => {})
  })

  afterAll(async () => {
    if (SKIP_TEST) return
    await prisma.contentSuggestion.deleteMany().catch(() => {})
    await prisma.auditLog.deleteMany().catch(() => {})
    await prisma.analyticsSignal.deleteMany().catch(() => {})
    await prisma.$disconnect()
  })

  it('creates exactly one suggestion per signal across repeated runs and audits once', async () => {
    if (SKIP_TEST) {
      // eslint-disable-next-line no-console
      console.warn('Phase 11 idempotency test skipped (DB not available)')
      return
    }

    // 1) Seed one AnalyticsSignal (use a valid DB enum value)
    const dbSignal = await prisma.analyticsSignal.create({
      data: {
        courseId: 'course_test_1',
        type: 'LOW_COMPLETION_RATE',
        severity: 'INFO',
        metadata: { completionRate: 0.1 },
      },
    })

    // 2) Prepare an in-memory signal shaped for the Insight Engine mapping
    // (engine mappings expect `LOW_COMPLETION` signal type)
    const engineSignal: any = {
      id: dbSignal.id,
      type: 'LOW_COMPLETION',
      courseId: dbSignal.courseId,
      targetId: 'lesson-test-1',
      metadata: { completionRate: 0.1 },
      createdAt: dbSignal.createdAt?.toISOString?.() ?? new Date().toISOString(),
    }

    // Ensure DB is empty of suggestions/audit
    await prisma.contentSuggestion.deleteMany()
    await prisma.auditLog.deleteMany()

    if (SKIP_TEST) {
      // eslint-disable-next-line no-console
      console.warn('Phase 11 idempotency test skipped (DB not available)')
      return
    }

    // Double-check DB reachability with a timeboxed ping — skip if unstable.
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB ping timeout')), 1500)),
      ])
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Phase 11 idempotency test skipped: DB ping failed', String(e))
      return
    }

    // First run: generate and persist
    const suggestions1 = generateSuggestionsForSignal(engineSignal)
    await saveSuggestions(prisma as any, suggestions1.map((s: any) => ({ ...s, sourceSignalId: dbSignal.id })))

    const allSuggestionsAfterFirst = await prisma.contentSuggestion.findMany()
    expect(allSuggestionsAfterFirst.length).toBe(1)
    const suggestion = allSuggestionsAfterFirst[0]
    expect(suggestion.sourceSignalId).toBe(dbSignal.id)
    // default status should be OPEN per schema
    expect(suggestion.status).toBe('OPEN')

    // Audit writes are non-blocking; poll briefly for the audit entry
    const waitFor = async (checkFn: () => Promise<boolean>, timeout = 2000, interval = 50) => {
      const start = Date.now()
      while (Date.now() - start < timeout) {
        if (await checkFn()) return true
        await new Promise((r) => setTimeout(r, interval))
      }
      return false
    }

    const found = await waitFor(async () => {
      const audits = await prisma.auditLog.findMany({ where: { action: 'SUGGESTION_CREATED' } })
      return audits.some(a => (a as any).entityId === suggestion.id || (a as any).details?.entityId === suggestion.id)
    }, 2000, 50)
    expect(found).toBe(true)

    // Second run: same signal -> should NOT create duplicate
    const suggestions2 = generateSuggestionsForSignal(engineSignal)
    await saveSuggestions(prisma as any, suggestions2.map((s: any) => ({ ...s, sourceSignalId: dbSignal.id })))

    const allSuggestionsAfterSecond = await prisma.contentSuggestion.findMany()
    expect(allSuggestionsAfterSecond.length).toBe(1)
    expect(allSuggestionsAfterSecond[0].id).toBe(suggestion.id)

    const auditsAfterSecond = await prisma.auditLog.findMany({ where: { action: 'SUGGESTION_CREATED' } })
    // No duplicate create audit expected — audit may store entityId either as top-level column or inside `details`
    const createAuditsForSuggestion = auditsAfterSecond.filter(a => (a as any).entityId === suggestion.id || (a as any).details?.entityId === suggestion.id)
    expect(createAuditsForSuggestion.length).toBe(1)
  }, 20000)
})
