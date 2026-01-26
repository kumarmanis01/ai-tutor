import { NextResponse } from 'next/server'

const ALLOWED = new Set(['lesson_viewed', 'lesson_completed', 'quiz_attempted', 'quiz_passed'])

import { formatErrorForResponse } from '@/lib/errorResponse';

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const events = Array.isArray(body) ? body : body?.events ?? []
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'no_events' }, { status: 400 })
    }

    // basic validation
    for (const ev of events) {
      if (!ev?.eventType || typeof ev.eventType !== 'string' || !ALLOWED.has(ev.eventType)) {
        return NextResponse.json({ error: 'invalid_event_type', eventType: ev?.eventType ?? null }, { status: 400 })
      }
    }

    // Fire-and-forget: write to DB but don't block on it
    try {
      const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma
      const rows = events.map((ev: any) => ({
        eventType: ev.eventType,
        userId: ev.userId ?? null,
        courseId: ev.courseId ?? null,
        lessonIdx: typeof ev.lessonIdx === 'number' ? ev.lessonIdx : null,
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
