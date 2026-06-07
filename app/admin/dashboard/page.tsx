import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { logger } from '@/lib/logger'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type Metrics = {
  activeStudentsToday: number | null
  sessionsToday: number | null
  latestCostMetric: { date: Date; totalCostUsd: number } | null
  openEscalations: number | null
  quarantinedQuestions: number | null
  unresolvedSafety: number | null
}

async function getMetrics(): Promise<Metrics> {
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
  const nowIst = new Date(Date.now() + IST_OFFSET_MS)
  const todayStart = new Date(nowIst)
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayStartUtc = new Date(todayStart.getTime() - IST_OFFSET_MS)
  const todayEndUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000)

  // Use allSettled so one failing widget cannot blank the whole page.
  // CLAUDE.md frontend rule: "one widget failing must never blank the
  // whole page." Each metric resolves to its value or null; the renderer
  // shows "--" for null values.
  const results = await Promise.allSettled([
    prisma.structuredSession.groupBy({
      by: ['studentId'],
      where: { startedAt: { gte: todayStartUtc, lt: todayEndUtc } },
      _count: { studentId: true },
    }).then((r: { studentId: string }[]) => r.length),
    prisma.structuredSession.count({
      where: { startedAt: { gte: todayStartUtc, lt: todayEndUtc } },
    }),
    prisma.dailyCostMetric.findFirst({ orderBy: { date: 'desc' } }),
    prisma.doubtEscalation.count({ where: { resolvedAt: null } }),
    prisma.question.count({ where: { status: 'QUARANTINED' } }),
    prisma.safetyEvent.count({ where: { resolvedAt: null } }),
  ])

  const labels = [
    'activeStudentsToday',
    'sessionsToday',
    'latestCostMetric',
    'openEscalations',
    'quarantinedQuestions',
    'unresolvedSafety',
  ] as const

  const pick = <T,>(idx: number): T | null => {
    const r = results[idx]
    if (r.status === 'fulfilled') return r.value as T
    logger.warn('admin.dashboard.metric_failed', {
      event: 'admin_dashboard_metric_failed',
      context: { metric: labels[idx] },
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    })
    return null
  }

  return {
    activeStudentsToday: pick<number>(0),
    sessionsToday: pick<number>(1),
    latestCostMetric: pick<{ date: Date; totalCostUsd: number }>(2),
    openEscalations: pick<number>(3),
    quarantinedQuestions: pick<number>(4),
    unresolvedSafety: pick<number>(5),
  }
}

function MetricCard({
  label,
  value,
  href,
  warn,
}: {
  label: string
  value: string | number
  href?: string
  warn?: boolean
}) {
  const content = (
    <div
      className={`rounded-lg border p-4 bg-white ${warn && Number(value) > 0 ? 'border-amber-300' : 'border-gray-200'}`}
    >
      <div className={`text-3xl font-bold ${warn && Number(value) > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
  return href ? (
    <Link href={href} className="block hover:opacity-80">
      {content}
    </Link>
  ) : (
    content
  )
}

export default async function AdminDashboardPage() {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') redirect('/login')

  // getMetrics never throws -- allSettled gives null for any failed widget.
  const metrics = await getMetrics()

  const renderValue = (v: number | null) => (v == null ? '--' : v)
  const costLabel = metrics.latestCostMetric
    ? `$${metrics.latestCostMetric.totalCostUsd.toFixed(4)} (${metrics.latestCostMetric.date.toISOString().slice(0, 10)})`
    : '--'

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard label="Active students today" value={renderValue(metrics.activeStudentsToday)} />
        <MetricCard label="Sessions today" value={renderValue(metrics.sessionsToday)} href="/admin/sessions" />
        <MetricCard label="Cost today (USD)" value={costLabel} href="/admin/costs" />
        <MetricCard
          label="Open escalations"
          value={renderValue(metrics.openEscalations)}
          href="/admin/escalations"
          warn
        />
        <MetricCard
          label="Quarantined questions"
          value={renderValue(metrics.quarantinedQuestions)}
          href="/admin/questions"
          warn
        />
        <MetricCard
          label="Unresolved safety events"
          value={renderValue(metrics.unresolvedSafety)}
          href="/admin/safety"
          warn
        />
      </div>
    </div>
  )
}
