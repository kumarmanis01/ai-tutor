import React from 'react'
import { getServerSessionForHandlers } from '@/lib/session'

import Sparkline from '../../../../../components/AdminAnalytics/Sparkline'

export default async function Page({ params }: { params: { courseId: string } }) {
  const session = await getServerSessionForHandlers()
  const role = session?.user?.role ?? ''
  if (!session || !['admin', 'moderator'].includes(role)) {
    return <div>Unauthorized</div>
  }

  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma
  const { courseId } = params

  const aggregates = await db.analyticsDailyAggregate.findMany({ where: { courseId: String(courseId) }, orderBy: { day: 'desc' }, take: 90 })

  // days array intentionally unused in this view; kept for future per-day labels
  const views = aggregates.map((a: any) => a.totalViews || 0).reverse()
  const completions = aggregates.map((a: any) => a.totalCompletions || 0).reverse()

  const latest = aggregates[0] || null

  return (
    <div className="p-5">
      <h1>Course Analytics -- {courseId}</h1>
      <section className="flex gap-5">
        <div className="flex-1">
          <h3>Overview (last {views.length} days)</h3>
          <div className="w-full h-20">
            <Sparkline points={views} width={600} height={80} />
          </div>
          <div>Latest views: {latest ? latest.totalViews : '--'}</div>
          <div>Latest completions: {latest ? latest.totalCompletions : '--'}</div>
        </div>

        <div className="w-[320px]">
          <h3>Completion rate</h3>
          <div className="text-[28px]">{latest && latest.completionRate != null ? `${Math.round(latest.completionRate * 100)}%` : '--'}</div>
        </div>
      </section>

      <section className="mt-8">
        <h2>Lesson Drop-off (approx)</h2>
        <p className="text-gray-600">Per-lesson breakdown not available; using completion trend as an approximation.</p>
        <div className="w-full h-[120px]">
          <Sparkline points={completions.map((c: number, i: number) => (views[i] ? (views[i] - c) : 0))} width={800} height={120} />
        </div>
      </section>

      <section className="mt-8">
        <h2>Funnel (30d)</h2>
        <FunnelSummary courseId={courseId} db={db} />
      </section>
    </div>
  )
}

async function FunnelSummary({ courseId, db }: { courseId: string; db: any }) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const rows = await db.analyticsDailyAggregate.findMany({ where: { courseId: String(courseId), day: { gte: since } } })
  const totals = rows.reduce((acc: any, r: any) => {
    acc.views += r.totalViews || 0
    acc.completions += r.totalCompletions || 0
    return acc
  }, { views: 0, completions: 0 })

  const completionRate = totals.views > 0 ? totals.completions / totals.views : null

  return (
    <div>
      <div>Total views (30d): {totals.views}</div>
      <div>Total completions (30d): {totals.completions}</div>
      <div>Completion rate: {completionRate != null ? `${Math.round(completionRate * 100)}%` : '--'}</div>
    </div>
  )
}
