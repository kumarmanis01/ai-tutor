/**
 * FILE OBJECTIVE:
 * - Worker service that generates analytics signal events for a given course.
 * - Checks daily aggregates and recent quiz/purchase metrics to emit structured
 *   "signal.*" AnalyticsEvent rows consumed by the suggestions job.
 *
 * LINKED UNIT TEST:
 * - tests/workers/generateSignals.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | replace analyticsSignal writes with analyticsEvent; add FILE OBJECTIVE header; serialize Date fields in metadata; use ANALYTICS_EVENTS registry constants for quiz event types
 */

import { prisma } from '@/lib/prisma.js'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'

const SIGNAL_EVENT_TYPES = {
  LOW_COMPLETION_RATE: 'signal.low_completion_rate',
  LOW_QUIZ_PASS_RATE: 'signal.low_quiz_pass_rate',
  HIGH_REFUND_RATE: 'signal.high_refund_rate',
} as const

async function createSignalEvent(db: any, input: {
  courseId: string
  type: keyof typeof SIGNAL_EVENT_TYPES
  severity: 'CRITICAL' | 'WARNING'
  metadata: Record<string, unknown>
}) {
  await db.analyticsEvent.create({
    data: {
      courseId: input.courseId,
      eventType: SIGNAL_EVENT_TYPES[input.type],
      metadata: {
        type: input.type,
        severity: input.severity,
        ...input.metadata,
      },
    },
  })
}

export async function generateSignalsForCourse(courseId: string) {
  const db = (global as any).__TEST_PRISMA__ ?? prisma

  // 1) Low completion rate signal: look at latest aggregate
  const latest = await db.analyticsDailyAggregate.findFirst({ where: { courseId }, orderBy: { day: 'desc' } })
  if (latest && latest.completionRate != null && latest.completionRate < 0.2) {
    await createSignalEvent(db, {
      courseId,
      type: 'LOW_COMPLETION_RATE',
      severity: 'CRITICAL',
      metadata: { completionRate: latest.completionRate, day: (latest.day instanceof Date ? latest.day.toISOString() : latest.day) },
    })
  }

  // 2) Low quiz pass rate: use events from last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const attempted = await db.analyticsEvent.count({ where: { courseId, eventType: ANALYTICS_EVENTS.STUDENT.QUIZ_ATTEMPTED, createdAt: { gte: since } } })
  const passed = await db.analyticsEvent.count({ where: { courseId, eventType: ANALYTICS_EVENTS.STUDENT.QUIZ_PASSED, createdAt: { gte: since } } })
  if (attempted >= 10) {
    const passRate = attempted > 0 ? passed / attempted : 0
    if (passRate < 0.5) {
      await createSignalEvent(db, {
        courseId,
        type: 'LOW_QUIZ_PASS_RATE',
        severity: 'WARNING',
        metadata: { attempted, passed, passRate, periodStart: since.toISOString() },
      })
    }
  }

  // 3) High refund-like rate: approximate by purchases vs enrollments in last 30 days
  const purchases = await db.purchase.count({ where: { product: { courseId } } }).catch(() => 0)
  const enrollments = await db.enrollment.count({ where: { courseId, createdAt: { gte: since } } }).catch(() => 0)
  if (purchases >= 10) {
    const enrollRatio = purchases > 0 ? enrollments / purchases : 0
    if (enrollRatio < 0.5) {
      await createSignalEvent(db, {
        courseId,
        type: 'HIGH_REFUND_RATE',
        severity: 'WARNING',
        metadata: { purchases, enrollments, enrollRatio, periodStart: since.toISOString() },
      })
    }
  }
}

export async function generateSignalsForAllCourses() {
  const db = (global as any).__TEST_PRISMA__ ?? prisma
  // derive course list from aggregates
  const courses = await db.analyticsDailyAggregate.findMany({ select: { courseId: true }, distinct: ['courseId'] })
  for (const c of courses) {
    await generateSignalsForCourse(c.courseId)
  }
}

export default generateSignalsForAllCourses
