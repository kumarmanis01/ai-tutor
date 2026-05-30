/**
 * /admin/performance -- Slow Query Monitor
 *
 * Shows a 7-day summary of slow DB queries captured by the Prisma middleware.
 * Pure server component -- all data fetched server-side with Promise.all.
 */
import React from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { AdminTopbar } from '../../../components/admin/AdminTopbar';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

interface DaySummary {
  date: string;
  count: number;
  maxMs: number;
}

interface TopOp {
  model: string | null;
  operation: string;
  count: number;
  avgMs: number;
  maxMs: number;
}

interface RecentLog {
  id: string;
  model: string | null;
  operation: string;
  durationMs: number;
  createdAt: Date;
}

async function fetchPerfData() {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [allRows, recentLogs] = await Promise.all([
    prisma.slowQueryLog.findMany({
      where: { createdAt: { gte: since7d } },
      select: { model: true, operation: true, durationMs: true, createdAt: true },
      orderBy: { durationMs: 'desc' },
    }),
    prisma.slowQueryLog.findMany({
      where: { createdAt: { gte: since7d } },
      select: { id: true, model: true, operation: true, durationMs: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  // Summary stats
  const totalCount = allRows.length;
  const maxMs = allRows.length > 0 ? allRows[0].durationMs : 0;
  const durations = allRows.map((r) => r.durationMs).sort((a, b) => a - b);
  const p95Index = Math.max(0, Math.floor(durations.length * 0.95) - 1);
  const p95Ms = durations[p95Index] ?? 0;

  // Daily buckets (last 7 days)
  const bucketMap = new Map<string, { count: number; maxMs: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    bucketMap.set(d.toISOString().slice(0, 10), { count: 0, maxMs: 0 });
  }
  for (const row of allRows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    const bucket = bucketMap.get(key);
    if (bucket) {
      bucket.count += 1;
      if (row.durationMs > bucket.maxMs) bucket.maxMs = row.durationMs;
    }
  }
  const dailySummary: DaySummary[] = Array.from(bucketMap.entries()).map(([date, b]) => ({ date, count: b.count, maxMs: b.maxMs }));

  // Top operations
  const groupMap = new Map<string, { model: string | null; operation: string; count: number; maxMs: number; sumMs: number }>();
  for (const row of allRows) {
    const key = `${row.model ?? ''}::${row.operation}`;
    const g = groupMap.get(key);
    if (g) {
      g.count += 1;
      g.sumMs += row.durationMs;
      if (row.durationMs > g.maxMs) g.maxMs = row.durationMs;
    } else {
      groupMap.set(key, { model: row.model, operation: row.operation, count: 1, maxMs: row.durationMs, sumMs: row.durationMs });
    }
  }
  const topOps: TopOp[] = Array.from(groupMap.values())
    .sort((a, b) => b.count - a.count || b.maxMs - a.maxMs)
    .slice(0, 10)
    .map((g) => ({ model: g.model, operation: g.operation, count: g.count, avgMs: Math.round(g.sumMs / g.count), maxMs: g.maxMs }));

  return { totalCount, maxMs, p95Ms, dailySummary, topOps, recentLogs: recentLogs as RecentLog[] };
}

// ---------------------------------------------------------------------------
// Sparkline (inline SVG, no library)
// ---------------------------------------------------------------------------

function Sparkline({ data }: { data: DaySummary[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const W = 280;
  const H = 48;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.count / maxCount) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#534AB7"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * W;
        const y = H - (d.count / maxCount) * H;
        return (
          <circle key={d.date} cx={x} cy={y} r="3" fill="#534AB7" aria-label={`${d.date}: ${d.count}`} />
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PerformancePage() {
  const headersList = await headers();
  const session = await getServerSessionForHandlers(headersList);
  if (!session?.user || session.user.role !== 'admin') {
    redirect('/admin/login');
  }

  const { totalCount, maxMs, p95Ms, dailySummary, topOps, recentLogs } = await fetchPerfData();

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminTopbar title="Performance" />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Slow queries (7d)', value: totalCount },
            { label: 'p95 duration', value: `${p95Ms} ms` },
            { label: 'Max duration', value: `${maxMs} ms` },
            { label: 'Threshold', value: '500 ms' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Sparkline */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Daily slow query count (7d)</h2>
            <a
              href="/api/admin/performance/export"
              className="text-sm text-indigo-600 hover:underline"
            >
              Export CSV
            </a>
          </div>
          <Sparkline data={dailySummary} />
          <div className="flex justify-between mt-1">
            {dailySummary.map((d) => (
              <span key={d.date} className="text-[10px] text-gray-400">{d.date.slice(5)}</span>
            ))}
          </div>
        </div>

        {/* Top operations table */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Top 10 slow operations (7d)</h2>
          {topOps.length === 0 ? (
            <p className="text-sm text-gray-500">No slow queries in the past 7 days.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 pr-4 font-medium">Model</th>
                    <th className="pb-2 pr-4 font-medium">Operation</th>
                    <th className="pb-2 pr-4 font-medium text-right">Count</th>
                    <th className="pb-2 pr-4 font-medium text-right">Avg ms</th>
                    <th className="pb-2 font-medium text-right">Max ms</th>
                  </tr>
                </thead>
                <tbody>
                  {topOps.map((op, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-4 text-gray-700 font-mono text-xs">{op.model ?? '--'}</td>
                      <td className="py-2 pr-4 text-gray-700">{op.operation}</td>
                      <td className="py-2 pr-4 text-right text-gray-900 font-semibold">{op.count}</td>
                      <td className="py-2 pr-4 text-right text-gray-700">{op.avgMs}</td>
                      <td className="py-2 text-right text-gray-700">{op.maxMs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Raw log table */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Recent slow queries (last 50)</h2>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-gray-500">No slow queries in the past 7 days.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 pr-4 font-medium">Time (UTC)</th>
                    <th className="pb-2 pr-4 font-medium">Model</th>
                    <th className="pb-2 pr-4 font-medium">Operation</th>
                    <th className="pb-2 font-medium text-right">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-1.5 pr-4 text-gray-500 font-mono text-xs whitespace-nowrap">
                        {log.createdAt.toISOString().slice(0, 19).replace('T', ' ')}
                      </td>
                      <td className="py-1.5 pr-4 text-gray-700 font-mono text-xs">{log.model ?? '--'}</td>
                      <td className="py-1.5 pr-4 text-gray-700">{log.operation}</td>
                      <td className="py-1.5 text-right font-semibold text-gray-900">{log.durationMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
