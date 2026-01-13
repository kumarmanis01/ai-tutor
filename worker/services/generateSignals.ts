import { prisma } from '@/lib/prisma.js'

export async function generateSignalsForCourse(courseId: string) {
  const db = (global as any).__TEST_PRISMA__ ?? prisma

  // 1) Low completion rate signal: look at latest aggregate
  const latest = await db.analyticsDailyAggregate.findFirst({ where: { courseId }, orderBy: { day: 'desc' } })
  if (latest && latest.completionRate != null && latest.completionRate < 0.2) {
    await db.analyticsSignal.create({ data: { courseId, type: 'LOW_COMPLETION_RATE', severity: 'CRITICAL', metadata: { completionRate: latest.completionRate, day: latest.day } } })
  }

  // 2) Low quiz pass rate: use events from last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const attempted = await db.analyticsEvent.count({ where: { courseId, eventType: 'quiz_attempted', createdAt: { gte: since } } })
  const passed = await db.analyticsEvent.count({ where: { courseId, eventType: 'quiz_passed', createdAt: { gte: since } } })
  if (attempted >= 10) {
    const passRate = attempted > 0 ? passed / attempted : 0
    if (passRate < 0.5) {
      await db.analyticsSignal.create({ data: { courseId, type: 'LOW_QUIZ_PASS_RATE', severity: 'WARNING', metadata: { attempted, passed, passRate, periodStart: since } } })
    }
  }

  // 3) High refund-like rate: approximate by purchases vs enrollments in last 30 days
  const purchases = await db.purchase.count({ where: { product: { courseId } } }).catch(() => 0)
  const enrollments = await db.enrollment.count({ where: { courseId, createdAt: { gte: since } } }).catch(() => 0)
  if (purchases >= 10) {
    const enrollRatio = purchases > 0 ? enrollments / purchases : 0
    if (enrollRatio < 0.5) {
      await db.analyticsSignal.create({ data: { courseId, type: 'HIGH_REFUND_RATE', severity: 'WARNING', metadata: { purchases, enrollments, enrollRatio, periodStart: since } } })
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
