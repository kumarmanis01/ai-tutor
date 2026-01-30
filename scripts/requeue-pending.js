#!/usr/bin/env node
/*
 * Re-enqueue pending ExecutionJob rows into BullMQ queue `content-hydration`.
 * - Uses Prisma via @prisma/client
 * - Sets Bull jobId to the ExecutionJob.id for easy correlation
 * - Writes a JobExecutionLog ENQUEUED entry with meta.bullJobId
 * Usage: REDIS_URL="redis://..." node scripts/requeue-pending.js [--limit N]
 */

import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { Queue } from 'bullmq'
import { randomUUID } from 'crypto'

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

      // Special handling for syllabus jobs: create or reuse a HydrationJob
      if (String(job.jobType) === 'syllabus') {
        const payload = job.payload || {}
        // Resolve common fields from payload; tolerate different shapes
        const board = payload.board || payload.resolvedMeta?.board || null
        const grade = payload.grade || payload.resolvedMeta?.grade || null
        const subjectId = payload.subjectId || payload.resolvedMeta?.subjectId || payload.resolvedMeta?.subject?.id || null
        const language = payload.language || payload.resolvedMeta?.language || 'en'

        if (!subjectId || !board || !grade) {
          // Do NOT enqueue legacy ExecutionJob-only payloads anymore.
          // These legacy-only enqueues create jobs that bypass the HydrationJob invariant
          // and lead to missing syllabus data. Record a skip and surface for manual review.
          console.warn('[requeue] skipping legacy enqueue for', job.id, 'missing subject/board/grade')
          try {
            await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'REQUEUE_SKIPPED_MISSING_METADATA', prevStatus: 'pending', newStatus: 'pending', message: 'Missing subject/board/grade — manual review required', meta: { missingFields: { subjectId: !!subjectId, board: !!board, grade: !!grade }, originalPayload: job.payload || {} } } })
          } catch (e) {
            console.error('[requeue] failed to write skip log for', job.id, String(e))
          }
          continue
        }

        // Idempotent creation: check for existing pending/running HydrationJob
        let hydration = await prisma.hydrationJob.findFirst({ where: { jobType: 'syllabus', subjectId, grade, board, status: { in: ['pending','running'] } } })
        if (!hydration) {
          const generatedId = randomUUID()
          hydration = await prisma.hydrationJob.create({ data: { id: generatedId, rootJobId: generatedId, jobType: 'syllabus', board, grade, subjectId, language, difficulty: 'medium', status: 'pending' } })
          console.log('[requeue] created HydrationJob', hydration.id, 'for ExecutionJob', job.id)
        } else {
          console.log('[requeue] reusing existing HydrationJob', hydration.id, 'for ExecutionJob', job.id)
        }

        const bullJob = await q.add(`syllabus-${hydration.id}`, { type: 'SYLLABUS', payload: { jobId: hydration.id } }, { jobId: hydration.id })
        await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'ENQUEUED', prevStatus: 'pending', newStatus: 'pending', meta: { queue: 'content-hydration', workerType, bullJobId: bullJob?.id, hydrationJobId: hydration.id } } })
        console.log('[requeue] enqueued HydrationJob', hydration.id, 'for ExecutionJob', job.id, 'bullJobId=', bullJob?.id)
        continue
      }

      const bullJob = await q.add(`${workerType.toLowerCase()}-${job.id}`, { type: workerType, payload: { jobId: job.id, ...(job.payload || {}) } }, { jobId: job.id })

      await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'ENQUEUED', prevStatus: 'pending', newStatus: 'pending', meta: { queue: 'content-hydration', workerType, bullJobId: bullJob?.id } } })
      console.log('[requeue] enqueued', job.id, 'bullJobId=', bullJob?.id)
      } catch (err) {
      console.error('[requeue] failed for', job.id, String(err))
      try { await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'ENQUEUE_FAILED', prevStatus: 'pending', newStatus: 'pending', message: String(err) } }) } catch { /* ignore */ }
    }
  }

  await q.close()
  await prisma.$disconnect()
  console.log('[requeue] done')
}

main().catch((e) => { console.error(e); process.exit(1) })
