import { prisma as _prisma } from '@/lib/prisma.js'

const getDb = () => (global as any).__TEST_PRISMA__ ?? _prisma

function startOfDay(d: Date) {
  const dt = new Date(d)
  dt.setUTCHours(0,0,0,0)
  return dt
}

function endOfDay(d: Date) {
  const dt = new Date(d)
  dt.setUTCHours(24,0,0,0)
  return dt
}

export async function aggregateDay(date: Date) {
  const start = startOfDay(date)
  const end = endOfDay(date)

  const db = getDb()
  const events = await db.analyticsEvent.findMany({
    where: { createdAt: { gte: start, lt: end } },
    select: { eventType: true, courseId: true, lessonIdx: true, metadata: true, userId: true }
  })

  const byCourse = new Map<string, { views: number; completions: number; timeSum: number; timeCount: number; users: Set<string> }>()

  for (const ev of events) {
    const courseId = ev.courseId ?? 'unknown'
    let agg = byCourse.get(courseId)
    if (!agg) { agg = { views: 0, completions: 0, timeSum: 0, timeCount: 0, users: new Set() }; byCourse.set(courseId, agg) }

    if (ev.eventType === 'lesson_viewed') agg.views++
    if (ev.eventType === 'lesson_completed') agg.completions++
    if (ev.metadata && typeof ev.metadata === 'object') {
      const t = (ev.metadata as any).timeSpent
      if (typeof t === 'number' && !Number.isNaN(t)) { agg.timeSum += t; agg.timeCount += 1 }
    }
    if (ev.userId) agg.users.add(ev.userId)
  }

  // Persist aggregates
  for (const [courseId, agg] of byCourse.entries()) {
    const avgTime = agg.timeCount > 0 ? agg.timeSum / agg.timeCount : null
    const completionRate = agg.views > 0 ? agg.completions / agg.views : null
    // upsert by courseId + day
    try {
      await db.analyticsDailyAggregate.upsert({
        where: { courseId_day: { courseId, day: start } as any },
        update: { totalViews: agg.views, totalCompletions: agg.completions, avgTimePerLesson: avgTime, completionRate },
        create: { courseId, day: start, totalViews: agg.views, totalCompletions: agg.completions, avgTimePerLesson: avgTime, completionRate }
      })
    } catch (e) {
      // swallow to keep job resilient; log if logger present
      try {
        const logger = (await import('../../lib/logger.js')).logger
        logger?.error?.('aggregateDay: failed to upsert aggregate', { error: (e as Error)?.message ?? String(e) })
      } catch {}
    }
  }

  return Array.from(byCourse.keys())
}

export default aggregateDay

// Backwards-compatible named export used by some tests and job runners
export const runForAllCourses = aggregateDay
