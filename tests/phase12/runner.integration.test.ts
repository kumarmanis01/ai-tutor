jest.mock('@/regeneration/generatorAdapter')
import { prisma } from '@/lib/prisma'
import * as runner from '../../src/jobs/regenerationJobRunner'
import * as adapter from '@/regeneration/generatorAdapter'

describe('Regeneration job runner', () => {
  jest.setTimeout(60000)
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
    await prisma.jobLock.deleteMany().catch(()=>{})
    await prisma.$disconnect()
  })

  it('processes a pending job and persists output', async () => {
    if (SKIP) return
    // create a pending job
    const id1 = `job-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
    const rows: any = await (prisma as any).$queryRawUnsafe(insertSql, id1, 's-1', 'LESSON', 't-1', JSON.stringify({ foo: 'bar' }), 'PENDING', 'tester')
    const job = Array.isArray(rows) ? rows[0] : rows

    // mock adapter to return output (support both cjs/esModule shapes)
    if ((adapter as any).default && (adapter as any).default.mockResolvedValue) {
      (adapter as any).default.mockResolvedValue({ validated: true, outputJson: { content: 'new-lesson' } })
    }
    if ((adapter as any).mockResolvedValue) {
      (adapter as any).mockResolvedValue(Promise.resolve({ validated: true, outputJson: { content: 'new-lesson' } }))
    }

    const res = await runner.runRegenerationJobs()
    expect(res.processed).toBe(1)

    const jobAfter = await prisma.regenerationJob.findUnique({ where: { id: job.id }, select: { status: true, outputRef: true } })
    expect(jobAfter?.status).toBe('COMPLETED')
    expect(jobAfter?.outputRef).toBeDefined()

    const outputs = await prisma.regenerationOutput.findMany({ where: { jobId: job.id } })
    expect(outputs.length).toBe(1)
    expect(outputs[0].contentJson).toMatchObject({ content: 'new-lesson' })
  })

  it('marks job FAILED when adapter throws and records errorJson', async () => {
    if (SKIP) return
    const id2 = `job-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
    const rows2: any = await (prisma as any).$queryRawUnsafe(insertSql, id2, 's-2', 'LESSON', 't-2', JSON.stringify({ foo: 'bar' }), 'PENDING', 'tester')
    const job = Array.isArray(rows2) ? rows2[0] : rows2

    if ((adapter as any).default && (adapter as any).default.mockRejectedValue) {
      (adapter as any).default.mockRejectedValue(new Error('generator-failed'))
    }
    if ((adapter as any).mockRejectedValue) {
      (adapter as any).mockRejectedValue(Promise.reject(new Error('generator-failed')))
    }

    const res = await runner.runRegenerationJobs()
    expect(res.processed).toBe(0)

    const jobAfter = await prisma.regenerationJob.findUnique({ where: { id: job.id }, select: { status: true, errorJson: true } })
    expect(jobAfter?.status).toBe('FAILED')
    expect(jobAfter?.errorJson).toBeDefined()
  })
})
