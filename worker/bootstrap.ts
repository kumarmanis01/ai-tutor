#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Worker bootstrap: starts a content-hydration worker with lifecycle management.
 * - upserts WorkerLifecycle row
 * - sends heartbeats
 * - supports graceful drain and stop
 *
 * Usage (dev):
 *   REDIS_URL=redis://... DATABASE_URL=... node -r ts-node/register worker/bootstrap.ts --type=content-hydration --concurrency=2
 */

import { Worker, Job } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { hydrateNotes } from '@/hydrators/hydrateNotes'
import { hydrateQuestions } from '@/hydrators/hydrateQuestions'
import { assembleTest } from '@/hydrators/assembleTest'
import { handleSyllabusJob } from './index'
import os from 'os'

import minimist from 'minimist'
const argv = minimist(process.argv.slice(2))
const type = argv.type || 'content-hydration'
const lifecycleIdArg = argv.lifecycleId || argv.lifecycleid || argv.lid
const concurrency = Number(argv.concurrency || process.env.WORKER_CONCURRENCY || 2)
const heartbeatIntervalMs = Number(process.env.WORKER_HEARTBEAT_MS || 10000)

async function ensureLifecycleRow(providedId?: string) {
  const host = os.hostname()
  const pid = process.pid
  if (providedId) {
    // Use existing lifecycle row created by admin/controller. Update it with runtime info.
    await prisma.workerLifecycle.update({ where: { id: providedId }, data: { pid: pid, host, status: 'STARTING', startedAt: new Date(), lastHeartbeatAt: new Date() } })
    return providedId
  }
  const id = `wk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
  await prisma.workerLifecycle.create({ data: { id, type, host, pid, status: 'STARTING', startedAt: new Date(), lastHeartbeatAt: new Date() } })
  return id
}

function processor(job: Job) {
  const { type: jtype, payload } = job.data as any
  switch (jtype) {
    case 'NOTES':
      return hydrateNotes(payload.topicId, payload.language)
    case 'QUESTIONS':
      return hydrateQuestions(payload.topicId, payload.difficulty, payload.language)
    case 'SYLLABUS':
      if (!payload?.jobId) throw new Error('SYLLABUS job missing jobId')
      return handleSyllabusJob(payload.jobId)
    case 'ASSEMBLE_TEST':
      return assembleTest(payload.topicId)
    default:
      throw new Error(`UNKNOWN_JOB_TYPE: ${jtype}`)
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required')
    process.exit(2)
  }
  if (!process.env.REDIS_URL) {
    console.error('REDIS_URL required')
    process.exit(2)
  }

  const lifecycleId = await ensureLifecycleRow(lifecycleIdArg)

  // Workers are allowed to call LLMs. Explicitly enable LLM calls only in
  // worker runtime to enforce the AI safety boundary.
  try {
    process.env.ALLOW_LLM_CALLS = '1'
  } catch {
    /* ignore */
  }

  // create worker
  const worker = new Worker(type === 'content-hydration' ? 'content-hydration' : type, async (job: Job) => {
    // Worker must claim job in DB first (Job Ownership Contract)
    // For hydration jobs, processors must be careful to re-check DB state.
    return processor(job)
  }, { connection: redisConnection, concurrency })

  // mark running
  await prisma.workerLifecycle.update({ where: { id: lifecycleId }, data: { status: 'RUNNING', lastHeartbeatAt: new Date() } })

  // heartbeat loop
  const hb = setInterval(async () => {
    try {
      await prisma.workerLifecycle.update({ where: { id: lifecycleId }, data: { lastHeartbeatAt: new Date() } })
    } catch (err) {
      console.error('heartbeat failed', err)
    }
  }, heartbeatIntervalMs)

  async function shutdown(drain = true) {
    console.log('shutdown requested; drain=', drain)
    try {
      await prisma.workerLifecycle.update({ where: { id: lifecycleId }, data: { status: 'DRAINING' } })
      if (drain) {
        await worker.pause()
        // wait a short grace period for in-flight jobs (bounded)
        const timeout = Number(process.env.WORKER_DRAIN_TIMEOUT_MS || 30_000)
        await new Promise(r => setTimeout(r, Math.min(timeout, 5000)))
      }
      await worker.close()
      clearInterval(hb)
      await prisma.workerLifecycle.update({ where: { id: lifecycleId }, data: { status: 'STOPPED', stoppedAt: new Date() } })
      process.exit(0)
    } catch (err: any) {
      console.error('shutdown error', err)
      await prisma.workerLifecycle.update({ where: { id: lifecycleId }, data: { status: 'FAILED', stoppedAt: new Date(), meta: { error: String(err?.message || err) } } })
      process.exit(2)
    }
  }

  process.on('SIGINT', () => shutdown(true))
  process.on('SIGTERM', () => shutdown(true))

  worker.on('failed', async (job, err) => {
    console.error('[WORKER FAILED]', job?.id, err?.message)
  })

  worker.on('completed', (job) => {
    console.log('[WORKER COMPLETED]', job.id)
  })
}

main().catch(err => { console.error(err); process.exit(2) })
