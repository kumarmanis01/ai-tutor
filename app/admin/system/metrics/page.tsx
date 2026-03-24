/**
 * System Metrics page -- admin server component.
 *
 * Replaces the broken SWR + TelemetryView pattern that showed
 * "Loading metrics... Loading telemetry..." forever when
 * TelemetrySample table was empty or the telemetry API threw 500.
 *
 * Now calls systemHealth() and prisma directly, server-side,
 * so data renders immediately with no client-side loading state.
 */

import React from 'react';
import { systemHealth, type HealthStatus } from '@/lib/systemHealth';
import { prisma } from '@/lib/prisma';
import AlertOverlay from '@/components/Admin/AlertOverlay';

export const dynamic = 'force-dynamic';

// ── Small presentational components (server-only, no hooks) ──────────────────

function StatusDot({ status }: { status: HealthStatus }) {
  const colour =
    status === 'healthy'
      ? 'bg-green-500'
      : status === 'degraded'
      ? 'bg-yellow-400'
      : 'bg-red-500';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colour} mr-2`} />;
}

function StatusCard({
  label,
  status,
  detail,
}: {
  label: string;
  status: HealthStatus;
  detail: string;
}) {
  const border =
    status === 'healthy'
      ? 'border-green-200 bg-green-50'
      : status === 'degraded'
      ? 'border-yellow-200 bg-yellow-50'
      : 'border-red-200 bg-red-50';
  const text =
    status === 'healthy'
      ? 'text-green-700'
      : status === 'degraded'
      ? 'text-yellow-700'
      : 'text-red-700';
  return (
    <div className={`rounded-xl border-2 ${border} p-4`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`flex items-center font-semibold text-sm ${text}`}>
        <StatusDot status={status} />
        {detail}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  alert,
}: {
  label: string;
  value: number | string;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${alert ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}

// ── Data fetching ─────────────────────────────────────────────────────────────

export default async function SystemMetricsPage() {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [
    health,
    studentsActiveToday,
    sessionsToday,
    costThisMonth,
    aiTurnsToday,
    aiTurnsCachedToday,
  ] = await Promise.allSettled([
    systemHealth(),
    prisma.user.count({
      where: { role: 'user', lastSessionDate: { gte: todayStart } },
    }),
    prisma.learningSession.count({ where: { startedAt: { gte: todayStart } } }),
    prisma.dailyCostMetric.aggregate({
      where: { date: { gte: monthStart } },
      _sum: { totalCostUsd: true, sessions: true },
      _avg: { costPerSession: true },
    }),
    prisma.aITutorTurnLog.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.aITutorTurnLog.count({ where: { createdAt: { gte: todayStart }, cached: true } }),
  ]);

  // Unwrap settled results with safe fallbacks
  const h = health.status === 'fulfilled' ? health.value : null;
  const activeStudents = studentsActiveToday.status === 'fulfilled' ? studentsActiveToday.value : 0;
  const sessions = sessionsToday.status === 'fulfilled' ? sessionsToday.value : 0;
  const cost = costThisMonth.status === 'fulfilled' ? costThisMonth.value : null;
  const aiTotal = aiTurnsToday.status === 'fulfilled' ? aiTurnsToday.value : 0;
  const aiCached = aiTurnsCachedToday.status === 'fulfilled' ? aiTurnsCachedToday.value : 0;
  const cacheHitPct = aiTotal > 0 ? Math.round((aiCached / aiTotal) * 100) : 0;
  const costMonthUsd = cost?._sum?.totalCostUsd ?? 0;
  const avgCostPerSession = cost?._avg?.costPerSession ?? 0;

  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Client component -- renders nothing when no active alerts */}
      <AlertOverlay />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">System Metrics</h1>
        <p className="text-xs text-gray-400">Updated: {now} IST</p>
      </div>

      {health.status === 'rejected' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          systemHealth() failed -- {String((health as PromiseRejectedResult).reason)}
        </div>
      )}

      {/* ── Infrastructure health ──────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Infrastructure
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatusCard
            label="Database"
            status={h?.dependencies.database.status ?? 'unhealthy'}
            detail={
              h?.dependencies.database.latencyMs !== undefined
                ? `${h.dependencies.database.latencyMs} ms`
                : h?.dependencies.database.status === 'healthy'
                ? 'OK'
                : 'Unreachable'
            }
          />
          <StatusCard
            label="Redis"
            status={h?.dependencies.redis.status ?? 'unhealthy'}
            detail={
              h?.dependencies.redis.latencyMs !== undefined
                ? `${h.dependencies.redis.latencyMs} ms`
                : h?.dependencies.redis.status === 'healthy'
                ? 'OK'
                : 'Unreachable'
            }
          />
          <StatusCard
            label="Workers"
            status={
              (h?.workers.stale ?? 0) > 0
                ? 'degraded'
                : (h?.workers.running ?? 0) > 0
                ? 'healthy'
                : 'unhealthy'
            }
            detail={`${h?.workers.running ?? '-'} running, ${h?.workers.stale ?? '-'} stale`}
          />
          <StatusCard
            label="Overall"
            status={h?.overall ?? 'unhealthy'}
            detail={h?.overall ?? 'unknown'}
          />
        </div>
      </section>

      {/* ── Today's activity ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Today
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Active Students" value={activeStudents} />
          <StatCard label="Learning Sessions" value={sessions} />
          <StatCard label="AI Turns" value={aiTotal} />
          <StatCard
            label="Failed Jobs"
            value={h?.jobs.failedLast5m ?? 0}
            alert={(h?.jobs.failedLast5m ?? 0) > 0}
          />
        </div>
      </section>

      {/* ── Job queue ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Job Queue
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Pending Jobs" value={h?.jobs.pending ?? 0} />
          <StatCard label="Running Jobs" value={h?.jobs.running ?? 0} />
          <StatCard
            label="Stuck Running"
            value={h?.jobs.stuckRunning ?? 0}
            alert={(h?.jobs.stuckRunning ?? 0) > 0}
          />
          <StatCard label="Queue Depth (BullMQ)" value={h?.queue.depth ?? 0} />
        </div>
      </section>

      {/* ── AI / Cost telemetry ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          AI Telemetry
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Cost This Month (USD)"
            value={`$${costMonthUsd.toFixed(3)}`}
          />
          <StatCard
            label="Avg Cost / Session"
            value={`$${avgCostPerSession.toFixed(4)}`}
          />
          <StatCard
            label="Cache Hit Rate (today)"
            value={`${cacheHitPct}%`}
          />
          <StatCard
            label="Cached Turns / Total (today)"
            value={`${aiCached} / ${aiTotal}`}
          />
        </div>
      </section>
    </div>
  );
}
