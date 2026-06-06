/**
 * /admin/costs -- AI Cost & Usage
 *
 * Replaces simple table with: stats, 7-day sparkline, anomaly callout,
 * callType cost breakdown, and a 30-day history table.
 * Pure server component.
 */
import React from 'react'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { AdminTopbar } from '../../../components/admin/AdminTopbar'

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

async function fetchCostStats(metrics: MetricRow[]) {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const todayMetric = metrics.find(m => m.date.toISOString().slice(0, 10) === todayStr)
  const monthCost = metrics
    .filter(m => m.date >= monthStart)
    .reduce((s, m) => s + m.totalCostUsd, 0)

  const avgCps = metrics.length > 0
    ? metrics.reduce((s, m) => s + m.costPerSession, 0) / metrics.length
    : 0

  const logCountFail = (which: string) => (err: unknown) => {
    logger.warn('admin.costs.turn_log_count_failed', {
      event: 'admin_costs_turn_log_count_failed',
      context: { which },
      error: err instanceof Error ? err.message : String(err),
    })
    return 0
  }
  const [totalTurns, cachedTurns] = await Promise.all([
    prisma.aITutorTurnLog.count({ where: { createdAt: { gte: since7d } } }).catch(logCountFail('total')),
    prisma.aITutorTurnLog.count({ where: { createdAt: { gte: since7d }, cached: true } }).catch(logCountFail('cached')),
  ])

  const cacheHitRate = totalTurns > 0 ? Math.round((cachedTurns / totalTurns) * 100) : 0

  return {
    todayCostUsd: todayMetric?.totalCostUsd ?? null,
    monthCostUsd: monthCost,
    avgCostPerSession: avgCps,
    cacheHitRate,
  }
}

async function fetchCallTypeBreakdown() {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  return prisma.aITutorTurnLog.groupBy({
    by: ['callType'],
    _sum: { costUsd: true },
    _count: { _all: true },
    where: { createdAt: { gte: since7d } },
    orderBy: { _sum: { costUsd: 'desc' } },
  }).catch((err: unknown) => {
    logger.warn('admin.costs.call_type_breakdown_failed', {
      event: 'admin_costs_call_type_breakdown_failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return [] as Array<{ callType: string; _sum: { costUsd: number | null }; _count: { _all: number } }>
  })
}

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

type MetricRow = { id: string; date: Date; sessions: number; totalCostUsd: number; costPerSession: number }

function detectAnomaly(last7: MetricRow[]) {
  if (last7.length < 2) return null
  const avg = last7.reduce((s, m) => s + m.totalCostUsd, 0) / last7.length
  const anomaly = last7.find(m => m.totalCostUsd > avg * 1.5)
  return anomaly ? { metric: anomaly, avg } : null
}

// ---------------------------------------------------------------------------
// Inline SVG sparkline
// ---------------------------------------------------------------------------

function CostSparkline({ data }: { data: MetricRow[] }) {
  if (data.length === 0) {
    return <p className="text-[12px] text-gray-400 py-4">No cost data for last 7 days.</p>
  }

  const ordered = [...data].reverse() // oldest first
  const maxCost = Math.max(...ordered.map(m => m.totalCostUsd), 0.0001)
  const avg = ordered.reduce((s, m) => s + m.totalCostUsd, 0) / ordered.length

  const BAR_W = 28
  const GAP = 8
  const H = 48
  const svgW = ordered.length * (BAR_W + GAP) - GAP

  return (
    <div>
      <svg
        width={svgW}
        height={H + 20}
        className="overflow-visible"
        aria-label="7-day cost sparkline"
      >
        {ordered.map((m, i) => {
          const barH = Math.max(2, Math.round((m.totalCostUsd / maxCost) * H))
          const x = i * (BAR_W + GAP)
          const y = H - barH
          const isAnomaly = m.totalCostUsd > avg * 1.5
          const fill = isAnomaly ? '#BA7517' : '#534AB7'
          const dateStr = m.date.toISOString().slice(5, 10)
          return (
            <g key={m.id}>
              <rect x={x} y={y} width={BAR_W} height={barH} rx={3} fill={fill} opacity={0.85} />
              <text
                x={x + BAR_W / 2}
                y={H + 14}
                textAnchor="middle"
                fontSize="9"
                fill="currentColor"
                className="text-gray-400"
              >
                {dateStr}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="text-[10px] text-gray-400 mt-1">
        Amber bars = anomaly (&gt;1.5x avg ${avg.toFixed(4)}/day)
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CallType breakdown bars
// ---------------------------------------------------------------------------

function CallTypeBreakdown({
  rows,
}: {
  rows: { callType: string; _sum: { costUsd: number | null }; _count: { _all: number } }[]
}) {
  if (rows.length === 0) {
    return <p className="text-[12px] text-gray-400">No AI turn data for last 7 days.</p>
  }
  const maxCost = Math.max(...rows.map(r => r._sum.costUsd ?? 0), 0.0001)

  return (
    <div className="space-y-2.5">
      {rows.map(r => {
        const cost = r._sum.costUsd ?? 0
        const pct = Math.round((cost / maxCost) * 100)
        return (
          <div key={r.callType} className="flex items-center gap-3">
            <span className="text-[11px] text-gray-600 dark:text-gray-400 w-28 shrink-0 font-mono">
              {r.callType}
            </span>
            <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#534AB7] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] text-gray-500 w-20 text-right">
              ${cost.toFixed(4)} ({r._count._all})
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CostsPage() {
  const metrics = await prisma.dailyCostMetric.findMany({
    orderBy: { date: 'desc' },
    take: 30,
  }).catch(() => [])

  const last7 = metrics.slice(0, 7)

  const [stats, callTypes] = await Promise.all([
    fetchCostStats(metrics),
    fetchCallTypeBreakdown(),
  ])

  const anomaly = detectAnomaly(last7)

  return (
    <>
      <AdminTopbar title="Costs & Usage" />

      <div className="p-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Today's cost"
            value={stats.todayCostUsd !== null ? `$${stats.todayCostUsd.toFixed(4)}` : '--'}
          />
          <StatCard
            label="This month"
            value={`$${stats.monthCostUsd.toFixed(3)}`}
          />
          <StatCard
            label="Avg cost / session"
            value={`$${stats.avgCostPerSession.toFixed(5)}`}
            warn={stats.avgCostPerSession > 0.005}
          />
          <StatCard
            label="Cache hit rate"
            value={`${stats.cacheHitRate}%`}
            good={stats.cacheHitRate >= 30}
            sub="last 7 days"
          />
        </div>

        {/* Anomaly callout */}
        {anomaly && (
          <div className="flex items-start gap-2 bg-[#FAEEDA] border border-[#EF9F27] rounded-lg px-4 py-3 text-[12px] text-[#633806]">
            <span className="font-semibold shrink-0">Cost anomaly detected:</span>
            <span>
              {anomaly.metric.date.toISOString().slice(0, 10)} cost ${anomaly.metric.totalCostUsd.toFixed(4)} is{' '}
              {(anomaly.metric.totalCostUsd / anomaly.avg).toFixed(1)}x the 7-day average (${anomaly.avg.toFixed(4)}).
              Check for prompt bloat or missing cache keys.
            </span>
          </div>
        )}

        {/* Sparkline */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Daily cost -- last 7 days
          </h2>
          <CostSparkline data={last7} />
        </div>

        {/* CallType breakdown */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Cost by call type (last 7 days)
          </h2>
          <CallTypeBreakdown rows={callTypes} />
        </div>

        {/* 30-day history table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">
              30-day history
            </h2>
          </div>
          {metrics.length === 0 ? (
            <p className="text-[12px] text-gray-400 py-8 text-center">No cost data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900">
                    {['Date', 'Sessions', 'Total cost', 'Cost / session', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {metrics.map((m: any ) => {
                    const cps = m.costPerSession
                    const cpsCls =
                      cps < 0.003 ? 'text-[#1D9E75]' : cps <= 0.005 ? 'text-[#BA7517]' : 'text-[#E24B4A]'
                    const cpsLabel =
                      cps < 0.003 ? 'OK' : cps <= 0.005 ? 'Warn' : 'Alert'
                    return (
                      <tr key={m.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-2 font-mono text-[10px] text-gray-500">
                          {m.date.toISOString().slice(0, 10)}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                          {m.sessions.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          ${m.totalCostUsd.toFixed(4)}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                          ${cps.toFixed(5)}
                        </td>
                        <td className={`px-4 py-2 font-medium ${cpsCls}`}>{cpsLabel}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function StatCard({
  label,
  value,
  sub,
  warn,
  good,
}: {
  label: string
  value: string
  sub?: string
  warn?: boolean
  good?: boolean
}) {
  const valueCls = warn
    ? 'text-[#BA7517]'
    : good
    ? 'text-[#1D9E75]'
    : 'text-gray-900 dark:text-white'
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${valueCls}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
