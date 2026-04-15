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
import { NextResponse } from 'next/server'

// Canonical event types for learner analytics -- keep in sync with lib/analytics/client.ts
const ALLOWED = new Set(['lesson_viewed', 'lesson_completed', 'quiz_attempted', 'quiz_passed'])

import { formatErrorForResponse } from '@/lib/errorResponse';

function normalizeEvent(raw: any) {
  // Accept either `eventType`, legacy `type`, or `event` (from generic client)
  const eventType = raw?.eventType ?? raw?.type ?? raw?.event ?? null
  const userId = raw?.userId ?? null
  const courseId = raw?.courseId ?? null
  const lessonIdx = typeof raw?.lessonIdx === 'number' ? raw.lessonIdx : null
  const metadata = (raw?.metadata && typeof raw.metadata === 'object') ? raw.metadata : (raw?.data && typeof raw.data === 'object' ? raw.data : {})
  return { eventType, userId, courseId, lessonIdx, metadata }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const eventsRaw = Array.isArray(body) ? body : body?.events ?? []
    if (!Array.isArray(eventsRaw) || eventsRaw.length === 0) {
      return NextResponse.json({ error: 'no_events' }, { status: 400 })
    }

    const normalized = eventsRaw.map(normalizeEvent)

    // basic validation
    for (const ev of normalized) {
      if (!ev?.eventType || typeof ev.eventType !== 'string' || !ALLOWED.has(ev.eventType)) {
        return NextResponse.json({ error: 'invalid_event_type', eventType: ev?.eventType ?? null }, { status: 400 })
      }
    }

    // Fire-and-forget: write to DB but don't block on it
    try {
      const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma
      const rows = normalized.map((ev: any) => ({
        eventType: ev.eventType,
        userId: ev.userId ?? null,
        courseId: ev.courseId ?? null,
        lessonIdx: ev.lessonIdx ?? null,
        metadata: ev.metadata ?? {},
      }))
      // use createMany when available; swallow errors
      if (typeof db.analyticsEvent?.createMany === 'function') {
        db.analyticsEvent.createMany({ data: rows }).catch(() => {})
      } else {
        // fallback: individual creates
        rows.forEach((r: any) => db.analyticsEvent.create?.({ data: r }).catch(() => {}))
      }
    } catch {
      // swallow DB errors to keep endpoint fire-and-forget
    }

    return NextResponse.json({ ok: true }, { status: 202 })
  } catch (err) {
    return NextResponse.json({ error: 'bad_request', detail: formatErrorForResponse(err) }, { status: 400 })
  }
}

export default POST
