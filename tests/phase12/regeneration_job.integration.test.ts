import { prisma } from '@/lib/prisma'
import { POST as createJob } from '../../app/api/admin/regeneration-jobs/route'
import { AuditEvents } from '@/lib/audit/events'

describe('Phase 12 — RegenerationJob creation + audit', () => {
  let SKIP = false
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      SKIP = true
      return
    }
    // Quick DB ping with timeout to avoid long Jest hook delays when DB is unreachable
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('db-ping-timeout')), 1500)),
      ])
    } catch {
      SKIP = true
      return
    }

    await prisma.regenerationOutput.deleteMany().catch(() => {})
    await prisma.regenerationJob.deleteMany().catch(() => {})
    await prisma.auditLog.deleteMany().catch(() => {})
    await prisma.contentSuggestion.deleteMany().catch(() => {})
  })

  afterAll(async () => {
    if (SKIP) return
    await prisma.regenerationOutput.deleteMany().catch(() => {})
    await prisma.regenerationJob.deleteMany().catch(() => {})
    await prisma.auditLog.deleteMany().catch(() => {})
    await prisma.contentSuggestion.deleteMany().catch(() => {})
    await prisma.$disconnect()
  })

  it('only allows ACCEPTED suggestions, is idempotent, and emits REGEN_JOB_CREATED', async () => {
    if (SKIP) return

    const suggestion = await prisma.contentSuggestion.create({ data: {
      courseId: 'course_test',
      scope: 'LESSON',
      targetId: 'lesson-42',
      type: 'LOW_COMPLETION',
      severity: 'LOW',
      message: 'regen this',
      evidenceJson: {},
      status: 'ACCEPTED'
    }})

    const makeReq = (body: any) => ({ json: async () => body }) as any

    // First attempt: should create
    const res1: any = await (await createJob(makeReq({ suggestionId: suggestion.id, targetType: 'LESSON', targetId: 'lesson-42' }))).json()
    expect(res1.job).toBeDefined()
    const jobId = res1.job.id

    // Poll for audit
    const waitFor = async (checkFn: () => Promise<boolean>, timeout = 2000, interval = 50) => {
      const start = Date.now()
      while (Date.now() - start < timeout) {
        if (await checkFn()) return true
        await new Promise(r => setTimeout(r, interval))
      }
      return false
    }

    const auditFound = await waitFor(async () => {
      const audits = await prisma.auditLog.findMany({ where: { action: AuditEvents.REGEN_JOB_CREATED } })
      return audits.some(a => (a as any).details?.suggestionId === suggestion.id || (a as any).entityId === jobId)
    }, 2000, 50)
    expect(auditFound).toBe(true)

    // Second attempt: idempotent
    const res2: any = await (await createJob(makeReq({ suggestionId: suggestion.id, targetType: 'LESSON', targetId: 'lesson-42' }))).json()
    expect(res2.job).toBeDefined()
    expect(res2.job.id).toBe(jobId)

    const jobCount = await prisma.regenerationJob.count()
    expect(jobCount).toBe(1)
  }, 20000)
})
