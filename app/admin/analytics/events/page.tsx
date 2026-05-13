/**
 * FILE OBJECTIVE:
 * - Admin dashboard for AnalyticsEvent-backed student telemetry.
 *   Surfaces funnel health, event coverage, top event mix, course activity,
 *   daily trend and recent signal events. Runs entirely from the AnalyticsEvent
 *   table -- parallel to (and does not replace) the readiness-based
 *   learning-analytics page.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/analytics/events/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | created as new parallel page reading from AnalyticsEvent
 */

import React from 'react'
import { ANALYTICS_EVENTS, ANALYTICS_SIGNAL_EVENT_PREFIX, ALL_ANALYTICS_EVENT_SET } from '@/lib/analytics/events'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { AdminTopbar } from '../../../../components/admin/AdminTopbar'

const DAYS_IN_WEEK = 7
const DAYS_IN_MONTH = 30
const DAYS_IN_TREND = 14
const EMPTY_VALUE = '--'

const CORE_EVENT_DEFINITIONS = [
  {
    label: 'Session start',
    eventType: ANALYTICS_EVENTS.STUDENT.SESSION_START,
    description: 'Student enters a guided learning session.',
  },
  {
    label: 'Session complete',
    eventType: ANALYTICS_EVENTS.STUDENT.SESSION_COMPLETE,
    description: 'Student finishes a session end to end.',
  },
  {
    label: 'Lesson viewed',
    eventType: ANALYTICS_EVENTS.STUDENT.LESSON_VIEWED,
    description: 'Lesson content becomes visible to the student.',
  },
  {
    label: 'Lesson completed',
    eventType: ANALYTICS_EVENTS.STUDENT.LESSON_COMPLETED,
    description: 'Lesson progression is completed successfully.',
  },
  {
    label: 'Quiz attempted',
    eventType: ANALYTICS_EVENTS.STUDENT.QUIZ_ATTEMPTED,
    description: 'Student submits a quiz attempt.',
  },
  {
    label: 'Quiz passed',
    eventType: ANALYTICS_EVENTS.STUDENT.QUIZ_PASSED,
    description: 'Student passes the quiz threshold.',
  },
  {
    label: 'Practice more',
    eventType: ANALYTICS_EVENTS.STUDENT.PRACTICE_MORE,
    description: 'Student asks for additional practice.',
  },
  {
    label: 'Doubt asked',
    eventType: ANALYTICS_EVENTS.STUDENT.DOUBTS_ASKED,
    description: 'Student asks for help inside a learning flow.',
  },
  {
    label: 'Content positive feedback',
    eventType: ANALYTICS_EVENTS.STUDENT.CONTENT_THUMBSUP,
    description: 'Student rated generated content positively.',
  },
  {
    label: 'Content negative feedback',
    eventType: ANALYTICS_EVENTS.STUDENT.CONTENT_THUMBSDOWN,
    description: 'Student rated generated content negatively.',
  },
  {
    label: 'Subject selected',
    eventType: ANALYTICS_EVENTS.STUDENT.SUBJECT_SELECTED,
    description: 'Student selected a subject in UI flows.',
  },
  {
    label: 'On-demand generation success',
    eventType: ANALYTICS_EVENTS.STUDENT.ON_DEMAND_CONTENT_GENERATION_SUCCESS,
    description: 'Student successfully generated on-demand study content.',
  },
  {
    label: 'On-demand generation failure',
    eventType: ANALYTICS_EVENTS.STUDENT.ON_DEMAND_CONTENT_GENERATION_FAILURE,
    description: 'On-demand generation failed (LLM or parse error).',
  },
  {
    label: 'Payment initiated',
    eventType: ANALYTICS_EVENTS.STUDENT.PAYMENT_INITIATED,
    description: 'Student started a payment flow (order created).',
  },
  {
    label: 'Payment success',
    eventType: ANALYTICS_EVENTS.STUDENT.PAYMENT_SUCCESS,
    description: 'Payment completed successfully (webhook / verify).',
  },
  {
    label: 'Payment failure',
    eventType: ANALYTICS_EVENTS.STUDENT.PAYMENT_FAILURE,
    description: 'A payment failed or was reconciled as failed.',
  },
  {
    label: 'Badge awarded',
    eventType: ANALYTICS_EVENTS.STUDENT.BADGE_NEW_BADGE,
    description: 'Student was awarded a new badge.',
  },
  {
    label: 'XP changed',
    eventType: ANALYTICS_EVENTS.STUDENT.XP_CHANGED,
    description: 'Student XP changed (award/penalty).',
  },
  {
    label: 'App open',
    eventType: ANALYTICS_EVENTS.STUDENT.APP_OPEN,
    description: 'App opened (client-side open event).',
  },
  {
    label: 'Auth sign-in',
    eventType: ANALYTICS_EVENTS.STUDENT.AUTH_SIGNIN,
    description: 'Student signed in via auth flow.',
  },
] as const

type CountByEvent = Record<string, number>
type LastSeenByEvent = Record<string, Date | null>

function formatPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) return EMPTY_VALUE
  return `${Math.round((numerator / denominator) * 100)}%`
}

function formatDateTime(value: Date | null): string {
  if (!value) return 'Never seen'
  return value.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildTrendRows(rows: Array<{ eventType: string; createdAt: Date }>) {
  const days = Array.from({ length: DAYS_IN_TREND }, (_, index) => {
    const day = new Date()
    day.setUTCHours(0, 0, 0, 0)
    day.setUTCDate(day.getUTCDate() - (DAYS_IN_TREND - index - 1))
    return {
      key: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      sessionStarts: 0,
      sessionCompletes: 0,
      lessonsCompleted: 0,
      doubtsAsked: 0,
    }
  })

  const byDay = new Map(days.map((day) => [day.key, day]))
  for (const row of rows) {
    const key = new Date(row.createdAt).toISOString().slice(0, 10)
    const day = byDay.get(key)
    if (!day) continue
    if (row.eventType === ANALYTICS_EVENTS.STUDENT.SESSION_START) day.sessionStarts += 1
    if (row.eventType === ANALYTICS_EVENTS.STUDENT.SESSION_COMPLETE) day.sessionCompletes += 1
    if (row.eventType === ANALYTICS_EVENTS.STUDENT.LESSON_COMPLETED) day.lessonsCompleted += 1
    if (row.eventType === ANALYTICS_EVENTS.STUDENT.DOUBTS_ASKED) day.doubtsAsked += 1
  }

  return days.reverse()
}

async function fetchEventAnalytics() {
  const since30d = new Date(Date.now() - DAYS_IN_MONTH * 24 * 60 * 60 * 1000)
  const since7d = new Date(Date.now() - DAYS_IN_WEEK * 24 * 60 * 60 * 1000)
  const since14d = new Date(Date.now() - DAYS_IN_TREND * 24 * 60 * 60 * 1000)

  const [
    totalEvents30d,
    totalEvents7d,
    activeStudents30d,
    activeCourses30d,
    groupedEvents30d,
    recentAllEvents,
    topCourses30d,
    trendEvents,
    recentSignals,
    signalCount30d,
  ] = await Promise.all([
    prisma.analyticsEvent.count({ where: { createdAt: { gte: since30d } } }),
    prisma.analyticsEvent.count({ where: { createdAt: { gte: since7d } } }),
    prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: since30d }, userId: { not: null } },
      distinct: ['userId'],
      select: { userId: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: since30d }, courseId: { not: null } },
      distinct: ['courseId'],
      select: { courseId: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ['eventType'],
      where: { createdAt: { gte: since30d } },
      _count: { _all: true },
    }),
    prisma.analyticsEvent.findMany({
      where: {
        createdAt: { gte: since30d },
      },
      orderBy: { createdAt: 'desc' },
      select: { eventType: true, createdAt: true },
      take: 5000,
    }),
    prisma.analyticsEvent.groupBy({
      by: ['courseId'],
      where: { createdAt: { gte: since30d }, courseId: { not: null } },
      _count: { _all: true },
    }),
    prisma.analyticsEvent.findMany({
      where: {
        createdAt: { gte: since14d },
        eventType: {
          in: [
            ANALYTICS_EVENTS.STUDENT.SESSION_START,
            ANALYTICS_EVENTS.STUDENT.SESSION_COMPLETE,
            ANALYTICS_EVENTS.STUDENT.LESSON_COMPLETED,
            ANALYTICS_EVENTS.STUDENT.DOUBTS_ASKED,
          ],
        },
      },
      select: { eventType: true, createdAt: true },
    }),
    prisma.analyticsEvent.findMany({
      where: {
        createdAt: { gte: since30d },
        eventType: { startsWith: ANALYTICS_SIGNAL_EVENT_PREFIX },
      },
      orderBy: { createdAt: 'desc' },
      select: { eventType: true, courseId: true, createdAt: true, metadata: true },
      take: 6,
    }),
    prisma.analyticsEvent.count({
      where: {
        createdAt: { gte: since30d },
        eventType: { startsWith: ANALYTICS_SIGNAL_EVENT_PREFIX },
      },
    }),
  ])

  const countByEvent: CountByEvent = {}
  for (const row of groupedEvents30d) {
    countByEvent[row.eventType] = row._count._all
  }

  const lastSeenByEvent: LastSeenByEvent = Object.fromEntries(
    Array.from(ALL_ANALYTICS_EVENT_SET).map((eventType) => [eventType, null]),
  )
  for (const row of recentAllEvents) {
    if (Object.prototype.hasOwnProperty.call(lastSeenByEvent, row.eventType) && lastSeenByEvent[row.eventType] === null) {
      lastSeenByEvent[row.eventType] = row.createdAt
    }
  }

  const topEventRows = groupedEvents30d
    .map((row) => ({ eventType: row.eventType, count: row._count._all }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8)

  const topCourseRows = topCourses30d
    .map((row) => ({ courseId: row.courseId ?? 'unknown', count: row._count._all }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8)

  const sessionStarts = countByEvent[ANALYTICS_EVENTS.STUDENT.SESSION_START] ?? 0
  const sessionCompletes = countByEvent[ANALYTICS_EVENTS.STUDENT.SESSION_COMPLETE] ?? 0
  const lessonViews = countByEvent[ANALYTICS_EVENTS.STUDENT.LESSON_VIEWED] ?? 0
  const lessonCompletions = countByEvent[ANALYTICS_EVENTS.STUDENT.LESSON_COMPLETED] ?? 0
  const quizAttempts = countByEvent[ANALYTICS_EVENTS.STUDENT.QUIZ_ATTEMPTED] ?? 0
  const quizPasses = countByEvent[ANALYTICS_EVENTS.STUDENT.QUIZ_PASSED] ?? 0
  const practiceMore = countByEvent[ANALYTICS_EVENTS.STUDENT.PRACTICE_MORE] ?? 0
  const doubtsAsked = countByEvent[ANALYTICS_EVENTS.STUDENT.DOUBTS_ASKED] ?? 0
  const contentThumbsUp = countByEvent[ANALYTICS_EVENTS.STUDENT.CONTENT_THUMBSUP] ?? 0
  const contentThumbsDown = countByEvent[ANALYTICS_EVENTS.STUDENT.CONTENT_THUMBSDOWN] ?? 0

  return {
    totalEvents30d,
    totalEvents7d,
    activeStudents30d: activeStudents30d.length,
    activeCourses30d: activeCourses30d.length,
    signalCount30d,
    topEventRows,
    topCourseRows,
    recentSignals,
    trendRows: buildTrendRows(trendEvents),
    coreEvents: CORE_EVENT_DEFINITIONS.map((definition) => ({
      ...definition,
      count: countByEvent[definition.eventType] ?? 0,
      lastSeen: lastSeenByEvent[definition.eventType],
    })),
    // Include a full registry view so admins can see defined events even if they
    // have not been emitted yet. Each entry shows 30d count and last seen.
    allDefinedEvents: Array.from(ALL_ANALYTICS_EVENT_SET).map((eventType) => ({
      eventType,
      count: countByEvent[eventType] ?? 0,
      lastSeen: lastSeenByEvent[eventType] ?? null,
    })),
    funnel: {
      sessionStarts,
      sessionCompletes,
      sessionCompletionRate: formatPercent(sessionCompletes, sessionStarts),
      lessonViews,
      lessonCompletions,
      lessonCompletionRate: formatPercent(lessonCompletions, lessonViews),
      quizAttempts,
      quizPasses,
      quizPassRate: formatPercent(quizPasses, quizAttempts),
      practiceMore,
      doubtsAsked,
      contentThumbsUp,
      contentThumbsDown,
      contentFeedback: contentThumbsUp + contentThumbsDown,
      contentApprovalRate: formatPercent(contentThumbsUp, contentThumbsUp + contentThumbsDown),
    },
  }
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
      <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>
    </div>
  )
}

function MetricPanel({
  label,
  value,
  numerator,
  denominator,
}: {
  label: string
  value: string
  numerator: number
  denominator: number
}) {
  const ratio = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
          <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {numerator}/{denominator}
        </p>
      </div>
      <progress
        className="mt-3 h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-[#EEEDFE] [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-[#534AB7]"
        max={100}
        value={ratio}
      />
    </div>
  )
}

function EventCoverageTable({
  rows,
}: {
  rows: Array<{
    label: string
    eventType: string
    description: string
    count: number
    lastSeen: Date | null
  }>
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800">
            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Event</th>
            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">30d count</th>
            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Last seen</th>
            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row) => {
            const statusClassName =
              row.count > 0 ? 'bg-[#EAF3DE] text-[#27500A]' : 'bg-[#FCEBEB] text-[#791F1F]'

            return (
              <tr key={row.eventType}>
                <td className="px-4 py-3 align-top">
                  <p className="font-medium text-gray-800 dark:text-gray-200">{row.label}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{row.description}</p>
                  <p className="mt-1 text-[11px] text-gray-400">{row.eventType}</p>
                </td>
                <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                  {row.count}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {formatDateTime(row.lastSeen)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClassName}`}
                  >
                    {row.count > 0 ? 'Active' : 'Missing trace'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SimpleTable({
  title,
  empty,
  headers,
  rows,
}: {
  title: string
  empty: string
  headers: string[]
  rows: React.ReactNode[]
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-400">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {headers.map((header) => (
                  <th key={header} className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{rows}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default async function EventAnalyticsPage() {
  const session = await getServerSessionForHandlers()
  const role = session?.user?.role ?? ''
  if (!session || !['admin', 'moderator'].includes(role)) {
    return <div className="p-5 text-sm text-gray-500">Unauthorized</div>
  }

  const analytics = await fetchEventAnalytics()

  return (
    <>
      <AdminTopbar title="Event Analytics" />

      <div className="space-y-6 p-5">
        {/* Summary bar */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Tracked events" value={analytics.totalEvents30d} sub="last 30 days" />
          <StatCard label="Tracked events" value={analytics.totalEvents7d} sub="last 7 days" />
          <StatCard
            label="Active students"
            value={analytics.activeStudents30d}
            sub="distinct student ids in 30d"
          />
          <StatCard
            label="Active courses"
            value={analytics.activeCourses30d}
            sub="distinct course ids in 30d"
          />
          <StatCard
            label="Signals raised"
            value={analytics.signalCount30d}
            sub="signal.* events in 30d"
          />
        </div>

        {/* Funnel + engagement */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Core funnel quality
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <MetricPanel
                label="Session completion rate"
                value={analytics.funnel.sessionCompletionRate}
                numerator={analytics.funnel.sessionCompletes}
                denominator={analytics.funnel.sessionStarts}
              />
              <MetricPanel
                label="Lesson completion rate"
                value={analytics.funnel.lessonCompletionRate}
                numerator={analytics.funnel.lessonCompletions}
                denominator={analytics.funnel.lessonViews}
              />
              <MetricPanel
                label="Quiz pass rate"
                value={analytics.funnel.quizPassRate}
                numerator={analytics.funnel.quizPasses}
                denominator={analytics.funnel.quizAttempts}
              />
              <MetricPanel
                label="Content approval rate"
                value={analytics.funnel.contentApprovalRate}
                numerator={analytics.funnel.contentThumbsUp}
                denominator={analytics.funnel.contentFeedback}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Engagement intent
            </h2>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-3 dark:border-gray-800">
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">
                    Practice-more requests
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Students explicitly asking for more practice after a session.
                  </p>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {analytics.funnel.practiceMore}
                </p>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-3 dark:border-gray-800">
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">Doubts asked</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Student help requests raised inside the learning experience.
                  </p>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {analytics.funnel.doubtsAsked}
                </p>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">
                    Feedback captured
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Positive plus negative content feedback events.
                  </p>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {analytics.funnel.contentFeedback}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Event coverage audit */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Core event coverage audit
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              These are the primary learning events tracked via the AnalyticsEvent table. Zero
              counts indicate instrumentation gaps or no traffic.
            </p>
          </div>
          <EventCoverageTable rows={analytics.coreEvents} />
        </div>

        {/* All defined events (registry) */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 mt-6">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">All defined events (registry)</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Every event defined in <code>lib/analytics/events.ts</code> with 30d counts.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Event</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">30d count</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {analytics.allDefinedEvents.map((row) => (
                  <tr key={row.eventType}>
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-gray-800 dark:text-gray-200">{row.eventType}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{row.count}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.lastSeen ? row.lastSeen.toLocaleString() : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Daily trend */}
        <SimpleTable
          title="Daily learning trend (14 days)"
          empty="No tracked session or lesson activity in the last 14 days."
          headers={['Day', 'Session starts', 'Session completes', 'Lessons completed', 'Doubts asked']}
          rows={analytics.trendRows.map((row) => (
            <tr key={row.key}>
              <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                {row.label}
              </td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.sessionStarts}</td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                {row.sessionCompletes}
              </td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                {row.lessonsCompleted}
              </td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.doubtsAsked}</td>
            </tr>
          ))}
        />

        {/* Top event mix + top courses */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SimpleTable
            title="Top event mix"
            empty="No analytics events in the last 30 days."
            headers={['Event type', '30d count']}
            rows={analytics.topEventRows.map((row) => (
              <tr key={row.eventType}>
                <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                  {row.eventType}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.count}</td>
              </tr>
            ))}
          />

          <SimpleTable
            title="Top active courses"
            empty="No course-bound events in the last 30 days."
            headers={['Course', '30d events']}
            rows={analytics.topCourseRows.map((row) => (
              <tr key={row.courseId}>
                <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                  {row.courseId}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.count}</td>
              </tr>
            ))}
          />
        </div>

        {/* Recent signals */}
        <SimpleTable
          title="Recent analytics signals"
          empty="No signal events raised in the last 30 days."
          headers={['When', 'Type', 'Course', 'Severity']}
          rows={analytics.recentSignals.map((signal) => {
            const metadata =
              signal.metadata && typeof signal.metadata === 'object'
                ? (signal.metadata as Record<string, unknown>)
                : {}
            const severity =
              typeof metadata.severity === 'string' ? metadata.severity : 'INFO'
            const type =
              typeof metadata.type === 'string' ? metadata.type : signal.eventType

            return (
              <tr key={`${signal.eventType}-${signal.createdAt.toISOString()}`}>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {formatDateTime(signal.createdAt)}
                </td>
                <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{type}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {signal.courseId ?? EMPTY_VALUE}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{severity}</td>
              </tr>
            )
          })}
        />
        </div>
    </>
  )
}
