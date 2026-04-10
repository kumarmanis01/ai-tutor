/**
 * FILE OBJECTIVE:
 * - API endpoints to get and update Parent digest preferences (opt-out, day, time, timezone).
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-settings.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | created GET/POST handlers for parent digest settings
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/** GET: return parent digest preferences for the authenticated parent user */
export async function GET() {
  try {
    const session = await getServerSessionForHandlers()
    if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const userId = (session.user as any).id
    const profile = await prisma.parentProfile.findUnique({ where: { userId } })

    // Fallback defaults if no profile exists yet
    const timezone = profile?.digestTimezone ?? (await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }))?.timezone ?? null

    // Include linked children for the parent settings UI (id, name, pause status)
    const links = await prisma.parentStudent.findMany({
      where: { parentId: userId, status: 'active' },
      include: { student: { select: { id: true, name: true, grade: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      digestOptOut: profile?.digestOptOut ?? false,
      inactivityOptOut: (profile as any)?.inactivityOptOut ?? false,
      digestDay: profile?.digestDay ?? 'Sunday',
      digestTime: profile?.digestTime ?? '09:00',
      digestTimezone: profile?.digestTimezone ?? timezone,
      children: links.map((l) => ({
        id: l.student.id,
        name: l.student.name ?? 'Student',
        grade: l.student.grade ?? null,
        isPaused: (l as any).isPaused ?? false,
        pausedUntil: (l as any).pausedUntil ? (l as any).pausedUntil.toISOString() : null,
        pauseReason: (l as any).pauseReason ?? null,
      })),
    })
  } catch (err) {
    logger.error('GET /api/parent/settings error', { className: 'api.parent.settings', methodName: 'GET', error: err })
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/** POST: update parent digest preferences (upsert) */
export async function POST(req: Request) {
  try {
    const session = await getServerSessionForHandlers()
    if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const userId = (session.user as any).id
    const body = await req.json()
    const { digestOptOut, inactivityOptOut, digestDay, digestTime, digestTimezone } = body as {
      digestOptOut?: boolean
      inactivityOptOut?: boolean
      digestDay?: string
      digestTime?: string
      digestTimezone?: string | null
    }

    // Basic validation
    if (digestOptOut !== undefined && typeof digestOptOut !== 'boolean') {
      return NextResponse.json({ error: 'invalid_digestOptOut' }, { status: 400 })
    }
    if (inactivityOptOut !== undefined && typeof inactivityOptOut !== 'boolean') {
      return NextResponse.json({ error: 'invalid_inactivityOptOut' }, { status: 400 })
    }
    if (digestDay !== undefined && typeof digestDay !== 'string') {
      return NextResponse.json({ error: 'invalid_digestDay' }, { status: 400 })
    }
    if (digestTime !== undefined && typeof digestTime !== 'string') {
      return NextResponse.json({ error: 'invalid_digestTime' }, { status: 400 })
    }

    const upsertData = {
      userId,
      digestOptOut: digestOptOut ?? false,
      inactivityOptOut: inactivityOptOut ?? false,
      digestDay: digestDay ?? 'Sunday',
      digestTime: digestTime ?? '09:00',
      digestTimezone: digestTimezone ?? null,
    }

    const saved = await prisma.parentProfile.upsert({
      where: { userId },
      create: upsertData,
      update: upsertData,
    })

    return NextResponse.json({ ok: true, profile: saved })
  } catch (err) {
    logger.error('POST /api/parent/settings error', { className: 'api.parent.settings', methodName: 'POST', error: err })
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
