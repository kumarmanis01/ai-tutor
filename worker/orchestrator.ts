#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Simple local orchestrator:
 * - polls `WorkerLifecycle` rows with status = 'STARTING'
 * - spawns a `node -r ts-node/register worker/bootstrap.ts --type <type>` process per row
 * - updates lifecycle with `pid` and marks `RUNNING`
 * - watches child process exit and marks STOPPED/FAILED
 * - listens for lifecycle state changes (DRAINING/STOPPED) and signals the child
 */

import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { prisma } from '@/lib/prisma'
import { startMetricsServer, incJobsSpawned } from './metrics-server'
import { createJobForWorker } from './k8s-adapter'
import { runAnalyticsJobs } from '@/src/jobs/analyticsJobs'

const POLL_MS = Number(process.env.ORCHESTRATOR_POLL_MS || 3000)
const WORKER_CMD = process.execPath // node executable
const ROOT = path.resolve(__dirname, '..')
const STATUS_DIR = path.join(ROOT, 'tmp')
const STATUS_FILE = path.join(STATUS_DIR, 'orchestrator.status.json')
const K8S_MODE = process.env.ORCHESTRATOR_K8S_MODE === '1' || process.env.ORCHESTRATOR_K8S_MODE === 'true'

type SpawnEntry = {
  proc: ChildProcessWithoutNullStreams
  lifecycleId: string
}

const children = new Map<string, SpawnEntry>()

async function pollAndSpawn() {
  try {
    const rows = await prisma.workerLifecycle.findMany({ where: { status: 'STARTING' } })

    for (const r of rows) {
      if (children.has(r.id)) continue

      console.log('[orchestrator] spawning worker for', r.id, r.type)

      const args = [
        '-r',
        'ts-node/register',
        path.join('worker', 'bootstrap.ts'),
        '--type',
        r.type || 'content-hydration',
        '--lifecycleId',
        r.id,
      ]
      const env = { ...process.env }

      const proc = spawn(WORKER_CMD, args, { cwd: ROOT, env, stdio: 'inherit' }) as ChildProcessWithoutNullStreams

      children.set(r.id, { proc, lifecycleId: r.id })

      // update DB with pid and status
      await prisma.workerLifecycle.update({ where: { id: r.id }, data: { pid: proc.pid ?? undefined, host: os.hostname(), status: 'RUNNING', lastHeartbeatAt: new Date() } })
      await prisma.auditLog.create({ data: { userId: null, action: 'WORKER_SPAWN', details: { workerId: r.id, pid: proc.pid } } })
      incJobsSpawned()

      proc.on('exit', async (code, signal) => {
        children.delete(r.id)
        try {
          if (code === 0) {
            await prisma.workerLifecycle.update({ where: { id: r.id }, data: { status: 'STOPPED', stoppedAt: new Date() } })
            await prisma.auditLog.create({ data: { userId: null, action: 'WORKER_EXIT', details: { workerId: r.id, code, signal } } })
          } else {
            await prisma.workerLifecycle.update({ where: { id: r.id }, data: { status: 'FAILED', stoppedAt: new Date(), meta: { code, signal } } })
            await prisma.auditLog.create({ data: { userId: null, action: 'WORKER_FAILED', details: { workerId: r.id, code, signal } } })
          }
        } catch (err) {
          console.error('[orchestrator] failed to update lifecycle on exit', err)
        }
      })
    }
  } catch (err) {
    console.error('[orchestrator] poll error', err)
  }
}

async function watchForDrains() {
  try {
    const draining = await prisma.workerLifecycle.findMany({ where: { status: 'DRAINING' } })
    for (const r of draining) {
      const entry = children.get(r.id)
      if (entry) {
        console.log('[orchestrator] sending SIGINT to', r.id)
        try { entry.proc.kill('SIGINT') } catch (e) { console.error(e) }
      }
    }
  } catch (err) {
    console.error('[orchestrator] drain watch error', err)
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

  // ensure status dir
  try { fs.mkdirSync(STATUS_DIR, { recursive: true }) } catch { /* ignore */ }

  // write initial status
  const status = { pid: process.pid, startedAt: new Date().toISOString(), lastHeartbeat: new Date().toISOString(), host: os.hostname(), mode: K8S_MODE ? 'k8s' : 'local' }
  try { fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2)) } catch (err) { console.error('failed to write status file', err) }

  console.log('[orchestrator] starting; poll ms=', POLL_MS, 'mode=', K8S_MODE ? 'k8s' : 'local')

  // heartbeat for status file
  setInterval(() => {
    try {
      const s = { ...status, lastHeartbeat: new Date().toISOString() }
      fs.writeFileSync(STATUS_FILE, JSON.stringify(s, null, 2))
    } catch (err) {
      console.error('failed to update status file', err)
    }
  }, Math.max(2000, POLL_MS))

  // start metrics server in both modes
  try { startMetricsServer() } catch (e) { console.error('failed to start metrics server', e) }

  // Optional: schedule daily analytics job (disabled by default)
  try {
    const enabled = process.env.ORCHESTRATOR_ENABLE_ANALYTICS === '1' || process.env.ORCHESTRATOR_ENABLE_ANALYTICS === 'true'
    if (enabled) {
      const hour = Number(process.env.ORCHESTRATOR_ANALYTICS_HOUR || '3') // UTC hour to run
      const scheduleDaily = async () => {
        try {
          console.log('[orchestrator] starting scheduled analytics job')
          const res = await runAnalyticsJobs()
          console.log(JSON.stringify({ job: 'analytics', status: res.success ? 'SUCCESS' : 'FAILED', durationMs: res.durationMs, error: res.error ?? null }))
        } catch (e) {
          console.error('[orchestrator] scheduled analytics job failed', e)
        }
      }

      // compute milliseconds until next hour:minute (hour:00 UTC)
      const now = new Date()
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0, 0))
      if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1)
      const firstDelay = next.getTime() - now.getTime()
      console.log(`[orchestrator] analytics job scheduled at hour=${hour} UTC; first run in ${Math.round(firstDelay/1000)}s`)
      setTimeout(() => {
        // run first then set interval every 24h
        void scheduleDaily()
        setInterval(() => { void scheduleDaily() }, 24 * 60 * 60 * 1000)
      }, firstDelay)
    }
  } catch (e) {
    console.error('[orchestrator] failed to schedule analytics job', e)
  }

  if (!K8S_MODE) {
    setInterval(async () => {
      await pollAndSpawn()
      await watchForDrains()
    }, POLL_MS)
  } else {
    console.log('[orchestrator] running in k8s mode: reconciling k8s Jobs instead of spawning local processes')

    // leader election using Postgres advisory lock (best-effort)
    const LOCK_ID = Number(process.env.ORCHESTRATOR_LOCK_ID || '1234567890')

    async function tryAcquireLock() {
      try {
        const res: any = await prisma.$queryRawUnsafe(`SELECT pg_try_advisory_lock(${LOCK_ID}) as acquired`)
        if (Array.isArray(res) && res.length > 0) return !!res[0].acquired
        if (res && typeof res.acquired !== 'undefined') return !!res.acquired
      } catch (err) {
        console.error('advisory lock check failed', err)
      }
      return false
    }

    setInterval(async () => {
      const isLeader = await tryAcquireLock()
      if (!isLeader) return

      // reconcile: create k8s Job for STARTING rows
      try {
        const rows = await prisma.workerLifecycle.findMany({ where: { status: 'STARTING' } })
        for (const r of rows) {
          try {
            console.log('[orchestrator:k8s] creating job for', r.id)
            await createJobForWorker(r.id, r.type)
            await prisma.workerLifecycle.update({ where: { id: r.id }, data: { status: 'RUNNING', lastHeartbeatAt: new Date() } })
            await prisma.auditLog.create({ data: { userId: null, action: 'WORKER_SPAWN_K8S', details: { workerId: r.id } } })
            incJobsSpawned()
          } catch (e) {
            console.error('[orchestrator:k8s] failed to create job', e)
          }
        }
      } catch (e) {
        console.error('[orchestrator:k8s] reconcile error', e)
      }
    }, POLL_MS)
  }
}

main().catch((err) => { console.error(err); process.exit(2) })
