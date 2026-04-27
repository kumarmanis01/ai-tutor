import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AdminTopbar } from '../../components/admin/AdminTopbar';
import { timeSince } from '@/lib/admin/formatters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActivityStatus = 'done' | 'running' | 'failed' | 'pending';

interface ActivityItem {
  id: string;
  label: string;
  detail: string;
  timestamp: Date;
  status: ActivityStatus;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function formatCostUsd(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function buildSparkline(
  sessions: { startedAt: Date }[],
  startOfToday: Date,
): { day: string; count: number }[] {
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - (6 - i));
    return { day: DAY_NAMES[d.getDay()], count: 0, ms: d.getTime() };
  });

  for (const s of sessions) {
    const sd = new Date(s.startedAt);
    sd.setHours(0, 0, 0, 0);
    const bucket = buckets.find(b => b.ms === sd.getTime());
    if (bucket) bucket.count++;
  }

  return buckets.map(({ day, count }) => ({ day, count }));
}

function buildActivityFeed(
  jobs: { id: string; status: string; jobType: string; subject: string | null; updatedAt: Date }[],
  signups: { id: string; createdAt: Date }[],
  safetyEvents: { id: string; triggerType: string; severity: string; createdAt: Date }[],
  ingests: { id: string; fileSource: string | null; chunksCreated: number; errors: number; runAt: Date }[],
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...jobs.map(j => ({
      id: j.id,
      label: `Hydration ${j.jobType}`,
      detail: j.subject ?? 'system',
      timestamp: j.updatedAt,
      status: (j.status === 'completed' ? 'done' : 'failed') as ActivityStatus,
    })),
    ...signups.map(u => ({
      id: u.id,
      label: 'New student registered',
      detail: 'User account created',
      timestamp: u.createdAt,
      status: 'done' as ActivityStatus,
    })),
    ...safetyEvents.map(e => ({
      id: e.id,
      label: `Safety: ${e.triggerType}`,
      detail: e.severity,
      timestamp: e.createdAt,
      status: 'failed' as ActivityStatus,
    })),
    ...ingests.map(r => ({
      id: r.id,
      label: 'Content ingest',
      detail: r.fileSource ? (r.fileSource.split('/').pop() ?? 'file') : 'unknown source',
      timestamp: r.runAt,
      status: (r.errors > 0 ? 'failed' : 'done') as ActivityStatus,
    })),
  ];

  items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return items.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  href,
  progressPct,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  progressPct?: number;
}) {
  const body = (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 h-full">
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1 leading-none">
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">{sub}</p>
      )}
      {progressPct !== undefined && (
        <div className="mt-2 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#534AB7] transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:opacity-80 transition-opacity h-full">
        {body}
      </Link>
    );
  }
  return body;
}

function StatusBadge({ status }: { status: ActivityStatus }) {
  const cfg: Record<ActivityStatus, { bg: string; text: string; label: string }> = {
    done:    { bg: 'bg-[#EAF3DE]', text: 'text-[#27500A]', label: 'Done' },
    running: { bg: 'bg-[#E6F1FB]', text: 'text-[#0C447C]', label: 'Running' },
    failed:  { bg: 'bg-[#FCEBEB]', text: 'text-[#791F1F]', label: 'Failed' },
    pending: { bg: 'bg-[#FAEEDA]', text: 'text-[#633806]', label: 'Pending' },
  };
  const { bg, text, label } = cfg[status];
  return (
    <span className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${bg} ${text}`}>
      {label}
    </span>
  );
}

function SessionSparkline({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const BAR_AREA_H = 36;

  return (
    <svg viewBox="0 0 280 54" className="w-full h-20" aria-label="Sessions last 7 days">
      {data.map((d, i) => {
        const barH = Math.max((d.count / max) * BAR_AREA_H, d.count > 0 ? 2 : 1);
        const x = i * 40 + 6;
        const y = BAR_AREA_H - barH + 4;
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={28} height={barH}
              rx="3"
              fill="#534AB7"
              opacity={d.count > 0 ? 0.85 : 0.12}
            />
            {d.count > 0 && (
              <text x={x + 14} y={y - 3} textAnchor="middle" fontSize="7" fill="#534AB7">
                {d.count}
              </text>
            )}
            <text x={x + 14} y={50} textAnchor="middle" fontSize="8" fill="#9ca3af">
              {d.day}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function QuickActionBtn({
  href,
  label,
  danger,
}: {
  href: string;
  label: string;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-[12px] font-medium min-h-[44px] transition-colors ${
        danger
          ? 'border-[#f9d7d7] bg-[#FCEBEB] text-[#791F1F] hover:bg-[#f9d7d7]'
          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
    >
      {label}
      <svg
        className="w-3.5 h-3.5 opacity-40 flex-shrink-0 ml-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminDashboardPage() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    activeStudentsToday,
    sessionsToday,
    costRow,
    subjectCounts,
    rawSessions7d,
    recentJobs,
    recentSignups,
    recentSafetyEvents,
    recentIngests,
    pendingReview,
    safetyAlerts,
    runningJobs,
  ] = await Promise.all([
    prisma.user
      .count({ where: { role: 'user', lastSessionDate: { gte: startOfToday } } })
      .catch(() => 0),

    prisma.structuredSession
      .count({ where: { startedAt: { gte: startOfToday } } })
      .catch(() => 0),

    prisma.dailyCostMetric
      .findFirst({ where: { date: { gte: startOfToday } }, select: { totalCostUsd: true } })
      .catch(() => null),

    Promise.all([
      prisma.subjectDef
        .count({
          where: {
            lifecycle: 'active',
            chapters: { some: { status: 'approved', lifecycle: 'active' } },
          },
        })
        .catch(() => 0),
      prisma.subjectDef
        .count({ where: { lifecycle: 'active' } })
        .catch(() => 0),
    ]),

    prisma.structuredSession
      .findMany({ where: { startedAt: { gte: since7d } }, select: { startedAt: true } })
      .catch(() => []),

    prisma.hydrationJob
      .findMany({
        where: {
          status: { in: ['completed', 'failed'] },
          hierarchyLevel: 0,
          updatedAt: { gte: since24h },
        },
        select: { id: true, status: true, jobType: true, subject: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      })
      .catch(() => []),

    prisma.user
      .findMany({
        where: { role: 'user', createdAt: { gte: since24h } },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
      .catch(() => []),

    prisma.safetyEvent
      .findMany({
        where: { createdAt: { gte: since24h } },
        select: { id: true, triggerType: true, severity: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
      .catch(() => []),

    prisma.ingestRunLog
      .findMany({
        where: { runAt: { gte: since24h } },
        select: { id: true, fileSource: true, chunksCreated: true, errors: true, runAt: true },
        orderBy: { runAt: 'desc' },
        take: 10,
      })
      .catch(() => []),

    prisma.topicDef
      .count({ where: { status: 'draft', lifecycle: 'active' } })
      .catch(() => 0),

    prisma.safetyEvent
      .count({ where: { resolvedAt: null } })
      .catch(() => 0),

    prisma.hydrationJob
      .count({ where: { status: 'running', hierarchyLevel: 0 } })
      .catch(() => 0),
  ]);

  const [hydratedSubjects, totalSubjects] = subjectCounts;
  const costToday = costRow?.totalCostUsd ?? 0;
  const sparklineData = buildSparkline(rawSessions7d, startOfToday);
  const activity = buildActivityFeed(recentJobs, recentSignups, recentSafetyEvents, recentIngests);

  return (
    <>
      <AdminTopbar title="Dashboard" runningJobs={runningJobs} />

      <div className="p-5 space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Active students today"
            value={activeStudentsToday}
            sub="With a session today"
          />
          <KpiCard
            label="Sessions today"
            value={sessionsToday}
            sub="Structured sessions started"
          />
          <KpiCard
            label="AI cost today"
            value={formatCostUsd(costToday)}
            sub="From DailyCostMetric"
          />
          <KpiCard
            label="Content ready"
            value={`${hydratedSubjects} / ${totalSubjects}`}
            sub="Subjects with approved chapters"
            href="/admin/content"
            progressPct={totalSubjects > 0 ? Math.round((hydratedSubjects / totalSubjects) * 100) : 0}
          />
        </div>

        {/* Sparkline + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300">
                Sessions -- last 7 days
              </p>
              <Link
                href="/admin/learning-analytics"
                className="text-[11px] text-[#534AB7] dark:text-[#7B74D6] hover:underline"
              >
                Full analytics
              </Link>
            </div>
            <SessionSparkline data={sparklineData} />
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-3">
              Quick actions
            </p>
            <div className="space-y-2">
              <QuickActionBtn href="/admin/content" label="Trigger content hydration" />
              <QuickActionBtn
                href="/admin/content-approval"
                label={pendingReview > 0 ? `Review ${pendingReview} pending items` : 'Review content'}
              />
              <QuickActionBtn
                href="/admin/safety"
                label={
                  safetyAlerts > 0
                    ? `${safetyAlerts} safety alert${safetyAlerts === 1 ? '' : 's'}`
                    : 'Safety & alerts'
                }
                danger={safetyAlerts > 0}
              />
              <QuickActionBtn href="/admin/notifications" label="Send broadcast" />
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300">
              Recent activity
            </p>
            <span className="text-[10px] text-gray-400">Last 24 h</span>
          </div>

          {activity.length === 0 ? (
            <p className="text-[12px] text-gray-400 dark:text-gray-500 py-6 text-center">
              No activity in the last 24 hours -- system is quiet.
            </p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {activity.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-gray-800 dark:text-gray-200 truncate">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                      {item.detail}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={item.status} />
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {timeSince(item.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
