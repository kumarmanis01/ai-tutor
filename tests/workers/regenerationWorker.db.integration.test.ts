jest.mock('@/regeneration/generatorAdapter')
import { prisma } from '../../lib/prisma'
import * as worker from '@/workers/regenerationWorker'
import * as adapter from '@/regeneration/generatorAdapter'

describe('Regeneration worker (DB-backed, mocked generator)', () => {
  jest.setTimeout(20000)
  let SKIP = false
  const insertSql = `INSERT INTO "public"."RegenerationJob" ("id","suggestionId","targetType","targetId","instructionJson","status","createdBy","createdAt","updatedAt") VALUES ($1,$2,$3::"RegenerationTargetType",$4,$5::jsonb,$6::"RegenerationJobStatus",$7,now(),now()) RETURNING *`

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) { SKIP = true; return }
    try { await prisma.$queryRaw`SELECT 1` } catch { SKIP = true; return }
    await prisma.regenerationOutput.deleteMany().catch(()=>{})
    await prisma.regenerationJob.deleteMany().catch(()=>{})
    await prisma.auditLog.deleteMany().catch(()=>{})
  })
  afterAll(async () => {
    if (SKIP) return
    await prisma.regenerationOutput.deleteMany().catch(()=>{})
    await prisma.regenerationJob.deleteMany().catch(()=>{})
    await prisma.auditLog.deleteMany().catch(()=>{})
    await prisma.$disconnect()
  })

  it('1) PENDING job is claimed and completed', async () => {
    if (SKIP) return
    const id = `job-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
    const rows: any = await (prisma as any).$queryRawUnsafe(insertSql, id, `s-${id}`, 'LESSON', `t-${id}`, JSON.stringify({ foo: 'bar' }), 'PENDING', 'tester')
    const job = Array.isArray(rows) ? rows[0] : rows

    // mock adapter to return output
    if ((adapter as any).default && (adapter as any).default.mockResolvedValue) {
      (adapter as any).default.mockResolvedValue({ validated: true, outputJson: { content: 'new-lesson' } })
    }
    if ((adapter as any).mockResolvedValue) {
      (adapter as any).mockResolvedValue(Promise.resolve({ validated: true, outputJson: { content: 'new-lesson' } }))
    }

      const _res = await worker.processNextJob()
    expect(_res).toBeDefined()

    const jobAfter = await prisma.regenerationJob.findUnique({ where: { id: job.id } })
    expect(jobAfter?.status).toBe('COMPLETED')
    expect(jobAfter?.outputRef).toBeDefined()

    const outputs = await prisma.regenerationOutput.findMany({ where: { jobId: job.id } })
    expect(outputs.length).toBe(1)
    expect(outputs[0].contentJson).toMatchObject({ content: 'new-lesson' })

    const audits = await prisma.auditLog.findMany({ where: { action: { in: ['REGEN_JOB_LOCKED','REGEN_JOB_STARTED','REGEN_JOB_COMPLETED'] } } })
    const actionsForJob = audits.filter(a => a.details && (a.details as any).jobId === job.id).map(a => a.action)
    expect(actionsForJob).toEqual(expect.arrayContaining(['REGEN_JOB_LOCKED','REGEN_JOB_STARTED','REGEN_JOB_COMPLETED']))
  })

  it('2) COMPLETED job is skipped', async () => {
    if (SKIP) return
    const id = `job-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
    const rows: any = await (prisma as any).$queryRawUnsafe(insertSql, id, `s-${id}`, 'LESSON', `t-${id}`, JSON.stringify({}), 'COMPLETED', 'tester')
    const job = Array.isArray(rows) ? rows[0] : rows

      await worker.processNextJob()
    // nothing should change for this job
    const refreshed = await prisma.regenerationJob.findUnique({ where: { id: job.id } })
    expect(refreshed?.status).toBe('COMPLETED')
    const out = await prisma.regenerationOutput.findFirst({ where: { jobId: job.id } })
    expect(out).toBeNull()
  })

  it('3) FAILED job is skipped', async () => {
    if (SKIP) return
    const id = `job-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
    const rows: any = await (prisma as any).$queryRawUnsafe(insertSql, id, `s-${id}`, 'LESSON', `t-${id}`, JSON.stringify({}), 'FAILED', 'tester')
    const job = Array.isArray(rows) ? rows[0] : rows

      await worker.processNextJob()
    const refreshed = await prisma.regenerationJob.findUnique({ where: { id: job.id } })
    expect(refreshed?.status).toBe('FAILED')
    const out = await prisma.regenerationOutput.findFirst({ where: { jobId: job.id } })
    expect(out).toBeNull()
  })

  it('4) Double execution prevented', async () => {
    if (SKIP) return
    const id = `job-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
    const rows: any = await (prisma as any).$queryRawUnsafe(insertSql, id, `s-${id}`, 'LESSON', `t-${id}`, JSON.stringify({}), 'PENDING', 'tester')
    const job = Array.isArray(rows) ? rows[0] : rows

    // Mock adapter to return quickly
    if ((adapter as any).default && (adapter as any).default.mockResolvedValue) {
      (adapter as any).default.mockResolvedValue({ validated: true, outputJson: { content: 'race' } })
    }
    if ((adapter as any).mockResolvedValue) {
      (adapter as any).mockResolvedValue(Promise.resolve({ validated: true, outputJson: { content: 'race' } }))
    }

    // Run two workers in parallel — only one should process the job
      await Promise.all([worker.processNextJob(), worker.processNextJob()])

    const refreshed = await prisma.regenerationJob.findUnique({ where: { id: job.id } })
    expect(refreshed?.status).toBe('COMPLETED')
  })

  it('5) Output written once', async () => {
    if (SKIP) return
    const id = `job-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
    const rows: any = await (prisma as any).$queryRawUnsafe(insertSql, id, `s-${id}`, 'LESSON', `t-${id}`, JSON.stringify({}), 'PENDING', 'tester')
    const job = Array.isArray(rows) ? rows[0] : rows

    if ((adapter as any).default && (adapter as any).default.mockResolvedValue) {
      (adapter as any).default.mockResolvedValue({ validated: true, outputJson: { content: 'once' } })
    }
    if ((adapter as any).mockResolvedValue) {
      (adapter as any).mockResolvedValue(Promise.resolve({ validated: true, outputJson: { content: 'once' } }))
    }

    await worker.processNextJob()
    const before = await prisma.regenerationOutput.findMany({ where: { jobId: job.id } })
    expect(before.length).toBe(1)

    // second call should be no-op for this job
    await worker.processNextJob()
    const after = await prisma.regenerationOutput.findMany({ where: { jobId: job.id } })
    expect(after.length).toBe(1)
  })

  it('6) Audit events emitted on COMPLETED and FAILED', async () => {
    if (SKIP) return
    // prepare failing adapter once
    if ((adapter as any).default && (adapter as any).default.mockRejectedValue) {
      (adapter as any).default.mockRejectedValue(new Error('simulated'))
    }
    if ((adapter as any).mockRejectedValue) {
      (adapter as any).mockRejectedValue(Promise.reject(new Error('simulated')))
    }

    const id = `job-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
    const rows: any = await (prisma as any).$queryRawUnsafe(insertSql, id, `s-${id}`, 'LESSON', `t-${id}`, JSON.stringify({}), 'PENDING', 'tester')
    const job = Array.isArray(rows) ? rows[0] : rows

    await worker.processNextJob()

    const refreshed = await prisma.regenerationJob.findUnique({ where: { id: job.id } })
    expect(refreshed?.status).toBe('FAILED')
    expect(refreshed?.errorJson).toBeDefined()

    const audits = await prisma.auditLog.findMany({ where: { action: { in: ['REGEN_JOB_LOCKED','REGEN_JOB_STARTED','REGEN_JOB_FAILED'] } } })
    const actionsForJob = audits.filter(a => a.details && (a.details as any).jobId === job.id).map(a => a.action)
    expect(actionsForJob).toEqual(expect.arrayContaining(['REGEN_JOB_LOCKED','REGEN_JOB_STARTED','REGEN_JOB_FAILED']))
  })
})
