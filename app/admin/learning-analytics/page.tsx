/**
 * /admin/learning-analytics -- Consolidated learning analytics
 *
 * Consolidates: student-learning, student-risk, learning-funnel,
 * learning-outcomes, recommendation-performance, curriculum-difficulty,
 * weak-topics.
 *
 * Pure server component -- no SWR, no client state.
 */
import React from 'react'
import { prisma } from '@/lib/prisma'
import { AdminTopbar } from '@/components/admin/AdminTopbar'

// ---------------------------------------------------------------------------
// Data helpers (each kept under 60 lines)
// ---------------------------------------------------------------------------

async function fetchStats() {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [sessions, avgMastery, totalStudents, diagCount, avgStreak] = await Promise.all([
    // Last 200 completed sessions to compute avg duration
    prisma.structuredSession.findMany({
      where: { completedAt: { not: null }, startedAt: { gte: since7d } },
      select: { startedAt: true, completedAt: true },
      take: 200,
    }).catch(() => []),

    prisma.studentTopicProgress.aggregate({
      _avg: { mastery: true },
    }).catch(() => ({ _avg: { mastery: null } })),

    prisma.user.count({ where: { role: 'user' } }).catch(() => 0),

    prisma.diagnosticSession.count({ where: { status: 'COMPLETED' } }).catch(() => 0),

    prisma.studentStreak.aggregate({
      where: { kind: 'daily' },
      _avg: { current: true },
    }).catch(() => ({ _avg: { current: null } })),
  ])

  const durationsMs = sessions
    .filter(s => s.completedAt !== null)
    .map(s => s.completedAt!.getTime() - s.startedAt.getTime())
  const avgSessionMs =
    durationsMs.length > 0
      ? durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length
      : 0

  return {
    avgSessionMin: Math.round(avgSessionMs / 60000),
    avgReadiness: Math.round((avgMastery._avg.mastery ?? 0) * 100),
    diagPct: totalStudents > 0 ? Math.round((diagCount / totalStudents) * 100) : 0,
    avgStreak: Math.round(avgStreak._avg.current ?? 0),
  }
}

async function fetchSubjectReadiness() {
  const topicProgress = await prisma.studentTopicProgress.groupBy({
    by: ['topicId'],
    _avg: { mastery: true },
    _count: { _all: true },
  }).catch(() => [])

  if (topicProgress.length === 0) return []

  const topicIds = topicProgress.map(r => r.topicId)
  const topics = await prisma.topicDef.findMany({
    where: { id: { in: topicIds } },
    select: {
      id: true,
      chapter: {
        select: {
          subject: {
            select: { id: true, name: true, class: { select: { grade: true } } },
          },
        },
      },
    },
  }).catch(() => [])

  const topicMap = new Map(topics.map(t => [t.id, t]))

  type SubjectAgg = { name: string; grade: number; totalMastery: number; count: number }
  const subjectAgg = new Map<string, SubjectAgg>()

  for (const row of topicProgress) {
    const topic = topicMap.get(row.topicId)
    if (!topic) continue
    const subject = topic.chapter.subject
    const existing = subjectAgg.get(subject.id) ?? {
      name: subject.name,
      grade: subject.class.grade,
      totalMastery: 0,
      count: 0,
    }
    existing.totalMastery += (row._avg.mastery ?? 0) * row._count._all
    existing.count += row._count._all
    subjectAgg.set(subject.id, existing)
  }

  return [...subjectAgg.values()]
    .map(s => ({
      name: s.name,
      grade: s.grade,
      mastery: s.count > 0 ? Math.round((s.totalMastery / s.count) * 100) : 0,
    }))
    .sort((a, b) => a.mastery - b.mastery)
}

async function fetchWeakTopics() {
  const weak = await prisma.studentTopicProgress.groupBy({
    by: ['topicId'],
    _avg: { mastery: true },
    _count: { _all: true },
    having: { mastery: { _avg: { lt: 0.4 } } },
    orderBy: { _avg: { mastery: 'asc' } },
    take: 10,
  }).catch(() => [])

  if (weak.length === 0) return []

  const topicIds = weak.map(w => w.topicId)
  const topics = await prisma.topicDef.findMany({
    where: { id: { in: topicIds } },
    select: {
      id: true,
      name: true,
      chapter: {
        select: {
          subject: {
            select: {
              name: true,
              class: { select: { grade: true } },
            },
          },
        },
      },
    },
  }).catch(() => [])

  const topicMap = new Map(topics.map(t => [t.id, t]))

  return weak.map(w => {
    const topic = topicMap.get(w.topicId)
    return {
      topicId: w.topicId,
      topicName: topic?.name ?? 'Unknown topic',
      subjectName: topic?.chapter.subject.name ?? '--',
      grade: topic?.chapter.subject.class.grade ?? 0,
      avgMastery: Math.round((w._avg.mastery ?? 0) * 100),
      studentsAffected: w._count._all,
    }
  })
}

// ---------------------------------------------------------------------------
// UI components (pure, no state)
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold mt-1 text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ReadinessBar({
  name,
  grade,
  mastery,
}: {
  name: string
  grade: number
  mastery: number
}) {
  const color =
    mastery >= 70 ? 'bg-[#1D9E75]' : mastery >= 40 ? 'bg-[#BA7517]' : 'bg-[#E24B4A]'
  const label =
    mastery >= 70 ? 'text-[#27500A]' : mastery >= 40 ? 'text-[#633806]' : 'text-[#791F1F]'

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0">
        <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate">{name}</p>
        <p className="text-[10px] text-gray-400">Grade {grade}</p>
      </div>
      <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${mastery}%` }}
        />
      </div>
      <span className={`text-[11px] font-medium w-9 text-right ${label}`}>{mastery}%</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function LearningAnalyticsPage() {
  const [stats, subjectBars, weakTopics] = await Promise.all([
    fetchStats(),
    fetchSubjectReadiness(),
    fetchWeakTopics(),
  ])

  return (
    <>
      <AdminTopbar title="Learning Analytics" />

      <div className="p-5 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Avg session length"
            value={stats.avgSessionMin > 0 ? `${stats.avgSessionMin} min` : '--'}
            sub="last 7 days"
          />
          <StatCard
            label="Avg readiness"
            value={`${stats.avgReadiness}%`}
            sub="all students"
          />
          <StatCard
            label="Diagnostic done"
            value={`${stats.diagPct}%`}
            sub="of enrolled students"
          />
          <StatCard
            label="Avg streak"
            value={`${stats.avgStreak} days`}
            sub="daily streak"
          />
        </div>

        {/* Subject readiness bars */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Subject readiness (worst first)
          </h2>
          {subjectBars.length === 0 ? (
            <p className="text-[12px] text-gray-400">No progress data yet.</p>
          ) : (
            <div className="space-y-3">
              {subjectBars.map(s => (
                <ReadinessBar key={`${s.name}-${s.grade}`} {...s} />
              ))}
            </div>
          )}
        </div>

        {/* Weak topics table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">
              Weak topics (avg mastery &lt; 40%)
            </h2>
          </div>
          {weakTopics.length === 0 ? (
            <p className="text-[12px] text-gray-400 py-8 text-center">No weak topics found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900">
                    {['Topic', 'Subject', 'Grade', 'Avg mastery', 'Students'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {weakTopics.map(t => (
                    <tr key={t.topicId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                        {t.topicName}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{t.subjectName}</td>
                      <td className="px-4 py-2.5 text-gray-500">{t.grade || '--'}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[#E24B4A] font-medium">{t.avgMastery}%</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{t.studentsAffected}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
