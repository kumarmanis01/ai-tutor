#!/usr/bin/env node
/*
 * Re-enqueue pending ExecutionJob rows into BullMQ queue `content-hydration`.
 * - Uses Prisma via @prisma/client
 * - Sets Bull jobId to the ExecutionJob.id for easy correlation
 * - Writes a JobExecutionLog ENQUEUED entry with meta.bullJobId
 * Usage: REDIS_URL="redis://..." node scripts/requeue-pending.js [--limit N]
 */

const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')
const { Queue } = require('bullmq')

function loadRedisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL
  const p = path.join(process.cwd(), '.env.production')
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*REDIS_URL=(.*)$/)
      if (m) return m[1]
    }
  }
  throw new Error('REDIS_URL not set in env or .env.production')
}

async function main() {
  const prisma = new PrismaClient()
  const REDIS_URL = loadRedisUrl()
  const q = new Queue('content-hydration', { connection: { url: REDIS_URL } })

  const argvLimitIndex = process.argv.indexOf('--limit')
  const limit = argvLimitIndex !== -1 ? Number(process.argv[argvLimitIndex + 1] || 100) : 100

  console.log('[requeue] scanning for pending ExecutionJob rows (limit=', limit, ')')
  const pending = await prisma.executionJob.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, take: limit })
  console.log('[requeue] found', pending.length, 'pending jobs')

  for (const job of pending) {
    try {
      const logs = await prisma.jobExecutionLog.findMany({ where: { jobId: job.id, event: 'ENQUEUED' }, orderBy: { createdAt: 'desc' }, take: 1 })
      const last = logs[0]
      if (last && last.meta && last.meta.bullJobId) {
        console.log('[requeue] skipping', job.id, 'already has bullJobId', last.meta.bullJobId)
        continue
      }

      const mapping = {
        syllabus: 'SYLLABUS',
        notes: 'NOTES',
        questions: 'QUESTIONS',
        tests: 'ASSEMBLE_TEST',
        assemble: 'ASSEMBLE_TEST',
      }
      const workerType = mapping[String(job.jobType)] || String(job.jobType).toUpperCase()

      console.log('[requeue] enqueueing', job.id, 'as', workerType)
      const bullJob = await q.add(`${workerType.toLowerCase()}-${job.id}`, { type: workerType, payload: { jobId: job.id, ...(job.payload || {}) } }, { jobId: job.id })

      await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'ENQUEUED', prevStatus: 'pending', newStatus: 'pending', meta: { queue: 'content-hydration', workerType, bullJobId: bullJob?.id } } })
      console.log('[requeue] enqueued', job.id, 'bullJobId=', bullJob?.id)
    } catch (err) {
      console.error('[requeue] failed for', job.id, String(err))
      try { await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'ENQUEUE_FAILED', prevStatus: 'pending', newStatus: 'pending', message: String(err) } }) } catch (e) { /* ignore */ }
    }
  }

  await q.close()
  await prisma.$disconnect()
  console.log('[requeue] done')
}

main().catch((e) => { console.error(e); process.exit(1) })
