/**
 * FILE OBJECTIVE:
 * - Server endpoint to accept batched analytics events from client (sendBeacon/fetch).
 * - Enqueues valid events to BullMQ analytics-ingest queue and returns 202 immediately.
 * - Falls back to direct DB write when Redis is unavailable (dev/test environments).
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
 * - 2026-04-21T00:00:00Z | staff-engineer | Task D: enqueue to BullMQ for non-blocking ingestion; DB fallback when Redis absent
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getAnalyticsQueue } from '@/lib/queues/analyticsQueue'

/** Canonical list of valid client-emitted event types. */
export const VALID_EVENT_TYPES = new Set([
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

    const toCreate: Array<{ eventType: string; userId: string | null; courseId: string | null; lessonIdx: number | null; metadata: Prisma.InputJsonValue }> = []
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
        logger.warn('analytics.endpoint: invalid event skipped', { error: String(pe), event: e })
      }
    }

    if (toCreate.length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid events in batch' }, { status: 400 })
    }

    // Prefer enqueue to BullMQ so the response is returned before any DB write.
    // Falls back to direct DB write when Redis is unavailable (non-worker envs).
    const queue = getAnalyticsQueue()
    if (queue) {
      try {
        await queue.addBulk(
          toCreate.map((ev) => ({ name: 'analytics.ingest', data: ev })),
        )
      } catch (qErr) {
        logger.warn('analytics.endpoint: queue unavailable, falling back to direct write', { error: String(qErr) })
        await writeDirect(toCreate)
      }
    } else {
      await writeDirect(toCreate)
    }

    const res = NextResponse.json({ ok: true, queued: toCreate.length }, { status: 202 })
    logger.logAPI(req, res, { className: 'AnalyticsAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    const res = NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
    logger.logAPI(req, res, { className: 'AnalyticsAPI', methodName: 'POST', error: String(err) }, start)
    return res
  }
}

async function writeDirect(rows: Array<{ eventType: string; userId: string | null; courseId: string | null; lessonIdx: number | null; metadata: Prisma.InputJsonValue }>) {
  try {
    await prisma.analyticsEvent.createMany({ data: rows })
  } catch (dbErr) {
    logger.warn('analytics.endpoint: createMany failed, falling back to single inserts', { error: String(dbErr) })
    for (const r of rows) {
      try {
        await prisma.analyticsEvent.create({ data: r })
      } catch (inner) {
        logger.warn('analytics.endpoint: single insert failed', { error: String(inner) })
      }
    }
  }
}
