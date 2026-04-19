#!/usr/bin/env node
import { spawnSync } from 'child_process'
import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  // Create two ExecutionJobs: one missing metadata (should be skipped), one complete (should create HydrationJob)
  const missing = await prisma.executionJob.create({ data: { jobType: 'syllabus', entityType: 'SUBJECT', entityId: 'test-subject-1', status: 'pending', payload: {} } })
  const complete = await prisma.executionJob.create({ data: { jobType: 'syllabus', entityType: 'SUBJECT', entityId: 'test-subject-2', status: 'pending', payload: { board: 'CBSE', grade: 5, subjectId: 'math', language: 'en' } } })

  console.log('[smoke] created jobs', { missing: missing.id, complete: complete.id })

  // Run the requeue script
  console.log('[smoke] running requeue-pending.js')
  const r = spawnSync('node', ['scripts/requeue-pending.js', '--limit', '10'], { stdio: 'inherit', env: process.env })
  if (r.error) {
    console.error('[smoke] requeue script failed to start', r.error)
    process.exit(2)
  }

  // Query jobExecutionLog entries
  const logsMissing = await prisma.jobExecutionLog.findMany({ where: { jobId: missing.id }, orderBy: { createdAt: 'asc' } })
  const logsComplete = await prisma.jobExecutionLog.findMany({ where: { jobId: complete.id }, orderBy: { createdAt: 'asc' } })

  console.log('[smoke] logs for missing job:', logsMissing.map((l) => ({ event: l.event, meta: l.meta, message: l.message })))
  console.log('[smoke] logs for complete job:', logsComplete.map((l) => ({ event: l.event, meta: l.meta, message: l.message })))

  const skipped = logsMissing.some((l) => l.event === 'REQUEUE_SKIPPED_MISSING_METADATA')
  const enqueued = logsComplete.some((l) => l.event === 'ENQUEUED' && l.meta && l.meta.hydrationJobId)

  if (!skipped) {
    console.error('[smoke] expected missing job to be skipped (REQUEUE_SKIPPED_MISSING_METADATA)')
    process.exit(3)
  }
  if (!enqueued) {
    console.error('[smoke] expected complete job to be enqueued with hydrationJobId')
    process.exit(4)
  }

  console.log('[smoke] success: requeue behavior verified')
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
