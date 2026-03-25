/**
 * /admin/system/health -- System health dashboard
 *
 * Server component -- no SWR, no client polling.
 * Builds on systemHealth() lib which already checks DB + Redis + workers + jobs.
 * Adds: pending migrations, WorkerLifecycle RUNNING entries, Redis memory.
 */
import React from 'react'
import { systemHealth, type HealthStatus } from '@/lib/systemHealth'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { AdminTopbar } from '@/components/admin/AdminTopbar'
import { RefreshButton } from './RefreshButton'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Extra data helpers
// ---------------------------------------------------------------------------

async function fetchRedisMemoryMb(): Promise<number | null> {
  try {
    const redis = getRedis()
    const info = await redis.info('memory')
    const match = info.match(/used_memory:(\d+)/)
    return match ? Math.round(parseInt(match[1], 10) / 1024 / 1024) : null
  } catch {
    return null
  }
}

async function fetchPendingMigrations(): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "_prisma_migrations"
      WHERE applied_steps_count = 0
    `
    return Number(rows[0]?.count ?? 0)
  } catch {
    return 0
  }
}

async function fetchTotalMigrations(): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "_prisma_migrations"
    `
    return Number(rows[0]?.count ?? 0)
  } catch {
    return 0
  }
}

async function fetchDbConnections(): Promise<number | null> {
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM pg_stat_activity WHERE state = 'active'
    `
    return Number(rows[0]?.count ?? 0)
  } catch {
    return null
  }
}

async function fetchWorkerRow(contains: string) {
  return prisma.workerLifecycle.findFirst({
    where: { status: 'RUNNING', type: { contains: contains } },
    orderBy: { lastHeartbeatAt: 'desc' },
    select: { type: true, lastHeartbeatAt: true, host: true, pid: true },
  }).catch(() => null)
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

const STATUS_COLOUR: Record<HealthStatus, string> = {
  healthy:   'bg-[#1D9E75]',
  degraded:  'bg-[#BA7517]',
  unhealthy: 'bg-[#E24B4A]',
}

const STATUS_TEXT: Record<HealthStatus, string> = {
  healthy:   'text-[#27500A]',
  degraded:  'text-[#633806]',
  unhealthy: 'text-[#791F1F]',
}

function ServiceRow({
  label,
  status,
  detail,
}: {
  label: string
  status: HealthStatus
  detail: string
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_COLOUR[status]}`} />
      <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300 w-28 shrink-0">{label}</span>
      <span className={`text-[11px] ${STATUS_TEXT[status]}`}>{detail}</span>
    </div>
  )
}

function UsageBar({
  label,
  used,
  max,
  unit,
}: {
  label: string
  used: number | null
  max: number
  unit: string
}) {
  if (used === null) return null
  const pct = Math.min(100, Math.round((used / max) * 100))
  const color =
    pct < 60 ? 'bg-[#1D9E75]' : pct < 80 ? 'bg-[#BA7517]' : 'bg-[#E24B4A]'
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="text-gray-500">{used} / {max} {unit}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SystemHealthPage() {
  const [health, redisMemMb, pendingMig, totalMig, dbConns, webWorker, taskWorker] =
    await Promise.all([
      systemHealth().catch(() => null),
      fetchRedisMemoryMb(),
      fetchPendingMigrations(),
      fetchTotalMigrations(),
      fetchDbConnections(),
      fetchWorkerRow('web'),
      fetchWorkerRow('worker'),
    ])

  const dbStatus: HealthStatus = health?.dependencies.database.status ?? 'unhealthy'
  const redisStatus: HealthStatus = health?.dependencies.redis.status ?? 'unhealthy'
  const workerStatus: HealthStatus =
    (health?.workers.stale ?? 0) > 0 ? 'degraded' :
    (health?.workers.running ?? 0) > 0 ? 'healthy' : 'unhealthy'
  const queueStatus: HealthStatus =
    (health?.jobs.stuckRunning ?? 0) > 0 ? 'degraded' :
    (health?.queue.depth ?? 0) > 100 ? 'degraded' : 'healthy'

  const dbDetail = health?.dependencies.database.latencyMs !== undefined
    ? `Connected -- ${health.dependencies.database.latencyMs}ms`
    : 'Unreachable'

  const redisDetail = health?.dependencies.redis.latencyMs !== undefined
    ? `Connected -- ${health.dependencies.redis.latencyMs}ms${redisMemMb !== null ? ` -- ${redisMemMb} MB` : ''}`
    : 'Unreachable'

  const webDetail = webWorker
    ? `${webWorker.type} pid ${webWorker.pid ?? '?'} on ${webWorker.host ?? '?'}`
    : 'No RUNNING web process'
  const workerDetail = taskWorker
    ? `${taskWorker.type} pid ${taskWorker.pid ?? '?'} on ${taskWorker.host ?? '?'}`
    : 'No RUNNING task worker'

  const migDetail = pendingMig > 0
    ? `${pendingMig} migration${pendingMig === 1 ? '' : 's'} pending`
    : `All ${totalMig} migrations applied`

  return (
    <>
      <AdminTopbar title="System Health">
        <RefreshButton />
      </AdminTopbar>

      <div className="p-5 space-y-5">
        {/* Services */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 pt-2 pb-1">
          <h2 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide pt-3 pb-1">
            Services
          </h2>
          <ServiceRow label="Database" status={dbStatus} detail={dbDetail} />
          <ServiceRow label="Redis" status={redisStatus} detail={redisDetail} />
          <ServiceRow
            label="Web process"
            status={webWorker ? 'healthy' : 'unhealthy'}
            detail={webDetail}
          />
          <ServiceRow
            label="Task worker"
            status={taskWorker ? 'healthy' : 'unhealthy'}
            detail={workerDetail}
          />
          <ServiceRow
            label="BullMQ queue"
            status={queueStatus}
            detail={`${health?.jobs.pending ?? '--'} pending, ${health?.jobs.running ?? '--'} running, ${health?.queue.depth ?? '--'} depth`}
          />
          <ServiceRow
            label="Overall"
            status={health?.overall ?? 'unhealthy'}
            detail={health?.overall ?? 'unknown'}
          />
        </div>

        {/* Resource usage */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
            Resource usage
          </h2>
          <UsageBar label="Redis memory" used={redisMemMb} max={256} unit="MB" />
          <UsageBar label="DB connections (active)" used={dbConns} max={20} unit="" />
          {(health?.jobs.running ?? 0) > 0 && (
            <UsageBar label="Running jobs" used={health?.jobs.running ?? 0} max={10} unit="" />
          )}
        </div>

        {/* Migration status */}
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-[12px] ${
          pendingMig > 0
            ? 'bg-[#FCEBEB] border border-[#f9d7d7] text-[#791F1F]'
            : 'bg-[#EAF3DE] border border-[#c8e6c9] text-[#27500A]'
        }`}>
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${pendingMig > 0 ? 'bg-[#E24B4A]' : 'bg-[#1D9E75]'}`} />
          <span className="font-medium">{migDetail}</span>
        </div>

        {/* Job queue detail */}
        {(health?.jobs.failedLast5m ?? 0) > 0 && (
          <div className="flex items-start gap-2 bg-[#FCEBEB] border border-[#f9d7d7] rounded-xl px-4 py-3 text-[12px] text-[#791F1F]">
            <span className="font-semibold shrink-0">Job failures:</span>
            <span>{health?.jobs.failedLast5m} job(s) failed in last 5 min. Check /admin/jobs for details.</span>
          </div>
        )}
        {(health?.jobs.stuckRunning ?? 0) > 0 && (
          <div className="flex items-start gap-2 bg-[#FAEEDA] border border-[#EF9F27] rounded-xl px-4 py-3 text-[12px] text-[#633806]">
            <span className="font-semibold shrink-0">Stuck jobs:</span>
            <span>{health?.jobs.stuckRunning} job(s) running beyond max runtime. Check /admin/jobs for details.</span>
          </div>
        )}
      </div>
    </>
  )
}
