/**
 * FILE OBJECTIVE:
 * - Server endpoint to accept batched analytics events from client (sendBeacon/fetch).
 * - Writes events into `AnalyticsEvent` table for downstream aggregation.
 *
 * LINKED UNIT TEST:
 * - tests/api/analytics.event.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot-planner | added analytics batch endpoint
 * - 2026-04-16T00:00:00Z | copilot | return 202 on success; 400 when all events invalid; add eventType allowlist
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/** Canonical list of valid client-emitted event types. */
const VALID_EVENT_TYPES = new Set([
  'lesson_viewed',
  'lesson_completed',
  'session_started',
  'session_completed',
  'quiz_submitted',
  'doubt_asked',
  'streak_updated',
  'xp_earned',
  'badge_unlocked',
  'hint_requested',
  'diagnostic_started',
  'diagnostic_completed',
  'page_view',
  'subject_selected',
])

const EventSchema = z.object({
  eventType: z.string().refine(
    (v) => VALID_EVENT_TYPES.has(v),
    (v) => ({ message: `Unknown eventType: ${v}` }),
  ),
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
      return NextResponse.json({ ok: false, error: 'No valid events in batch' }, { status: 400 })
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

    const res = NextResponse.json({ ok: true, inserted: toCreate.length }, { status: 202 })
    logger.logAPI(req, res, { className: 'AnalyticsAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    const res = NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
    logger.logAPI(req, res, { className: 'AnalyticsAPI', methodName: 'POST', error: String(err) }, start)
    return res
  }
}
