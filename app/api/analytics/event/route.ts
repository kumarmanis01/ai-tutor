/**
 * FILE OBJECTIVE:
 * - Server endpoint to accept batched analytics events from client (sendBeacon/fetch).
 * - Writes events into `AnalyticsEvent` table for downstream aggregation.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/analytics.event.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot-planner | added analytics batch endpoint
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

const EventSchema = z.object({
  eventType: z.string(),
  userId: z.string().nullable().optional(),
  courseId: z.string().nullable().optional(),
  lessonIdx: z.number().nullable().optional(),
  metadata: z.any().optional(),
})

export async function POST(req: Request) {
  const start = Date.now()
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ ok: false, error: 'empty body' }, { status: 400 })

    const events = Array.isArray(body) ? body : [body]

    const toCreate = [] as any[]
    for (const e of events) {
      try {
        const parsed = EventSchema.parse(e)
        toCreate.push({
          eventType: parsed.eventType,
          userId: parsed.userId ?? null,
          courseId: parsed.courseId ?? null,
          lessonIdx: typeof parsed.lessonIdx === 'number' ? parsed.lessonIdx : null,
          metadata: parsed.metadata ?? {},
        })
      } catch (pe) {
        // skip invalid event but continue processing
        logger.warn('analytics.endpoint: invalid event skipped', { error: String(pe), event: e })
      }
    }

    if (toCreate.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 })
    }

    // createMany for bulk insert
    try {
      await prisma.analyticsEvent.createMany({ data: toCreate })
    } catch (dbErr) {
      // Fallback to creating one-by-one if createMany fails
      logger.warn('analytics.endpoint: createMany failed, falling back', { error: String(dbErr) })
      for (const r of toCreate) {
        try { await prisma.analyticsEvent.create({ data: r }) } catch (inner) { logger.warn('analytics.endpoint: single insert failed', { error: String(inner) }) }
      }
    }

    const res = NextResponse.json({ ok: true, inserted: toCreate.length })
    logger.logAPI(req, res, { className: 'AnalyticsAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    const res = NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
    logger.logAPI(req, res, { className: 'AnalyticsAPI', methodName: 'POST', error: String(err) }, start)
    return res
  }
}
