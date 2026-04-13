/**
 * FILE OBJECTIVE:
 * - API endpoints to get and update Parent digest preferences (opt-out, day, time, timezone).
 * - Also exposes/accepts inactivityThresholdDays (F-PAR-021 AC-01): 2, 3, 5, or 7 days.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-settings.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.com
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | created GET/POST handlers for parent digest settings
 * - 2026-04-14T00:00:00Z | claude | added inactivityThresholdDays (F-PAR-021 AC-01)
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
    const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, language: true } })
    const timezone = profile?.digestTimezone ?? userRecord?.timezone ?? null
    // NFR language: expose current UI language so the toggle can reflect the saved preference
    const language = userRecord?.language ?? 'en'

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
      // F-PAR-021 AC-01: configurable inactivity alert threshold (days). Valid: 2, 3, 5, 7.
      inactivityThresholdDays: (profile as any)?.inactivityThresholdDays ?? 3,
      // NFR language: UI language preference ('en' or 'hi')
      language,
      children: links.map((l) => ({
        id: l.student.id,
        name: l.student.name ?? 'Student',
        grade: l.student.grade ?? null,
        isPaused: (l as any).isPaused ?? false,
        pausedUntil: (l as any).pausedUntil ? (l as any).pausedUntil.toISOString() : null,
        pauseReason: (l as any).pauseReason ?? null,
        // Per-child preferences
        // When true, this child is excluded from parent-facing reports/alerts
        excludeFromParentReport: (l as any).excludeFromParentReport ?? false,
        // When true, parent will not receive inactivity alerts for this child
        inactivityOptOut: (l as any).inactivityOptOut ?? false,
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
    const { digestOptOut, inactivityOptOut, digestDay, digestTime, digestTimezone, inactivityThresholdDays, language } = body as {
      digestOptOut?: boolean
      inactivityOptOut?: boolean
      digestDay?: string
      digestTime?: string
      digestTimezone?: string | null
      inactivityThresholdDays?: number
      language?: string
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
    // F-PAR-021 AC-01: only allow 2, 3, 5, or 7 days
    const VALID_THRESHOLDS = [2, 3, 5, 7]
    if (inactivityThresholdDays !== undefined && !VALID_THRESHOLDS.includes(inactivityThresholdDays)) {
      return NextResponse.json({ error: 'invalid_inactivityThresholdDays: must be 2, 3, 5, or 7' }, { status: 400 })
    }
    // NFR language: only 'en' or 'hi' are supported
    const VALID_LANGUAGES = ['en', 'hi']
    if (language !== undefined && !VALID_LANGUAGES.includes(language)) {
      return NextResponse.json({ error: 'invalid_language: must be en or hi' }, { status: 400 })
    }

    const createData = {
      userId,
      digestOptOut: digestOptOut ?? false,
      inactivityOptOut: inactivityOptOut ?? false,
      digestDay: digestDay ?? 'Sunday',
      digestTime: digestTime ?? '09:00',
      digestTimezone: digestTimezone ?? null,
      inactivityThresholdDays: inactivityThresholdDays ?? 3,
    }

    const updateData: any = {}
    if (digestOptOut !== undefined) updateData.digestOptOut = digestOptOut
    if (inactivityOptOut !== undefined) updateData.inactivityOptOut = inactivityOptOut
    if (digestDay !== undefined) updateData.digestDay = digestDay
    if (digestTime !== undefined) updateData.digestTime = digestTime
    if (digestTimezone !== undefined) updateData.digestTimezone = digestTimezone
    if (inactivityThresholdDays !== undefined) updateData.inactivityThresholdDays = inactivityThresholdDays

    const saved = await prisma.parentProfile.upsert({
      where: { userId },
      create: createData,
      update: updateData,
    })

    // NFR language: update User.language when requested
    if (language !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { language: language as any },
      })
    }

    // Optional: batch update per-child preferences if provided in the request body.
    // Body shape: { children: [{ id: string, excludeFromParentReport?: boolean, inactivityOptOut?: boolean }] }
    const childrenUpdates = (body as any)?.children
    const updatedChildren: Array<{ id: string; excludeFromParentReport?: boolean; inactivityOptOut?: boolean }> = []
    if (childrenUpdates !== undefined) {
      if (!Array.isArray(childrenUpdates)) {
        return NextResponse.json({ error: 'invalid_children' }, { status: 400 })
      }

      for (const c of childrenUpdates) {
        const studentId = typeof c?.id === 'string' ? c.id.trim() : ''
        const exclude = c?.excludeFromParentReport === undefined ? undefined : Boolean(c.excludeFromParentReport)
        const inact = c?.inactivityOptOut === undefined ? undefined : Boolean(c.inactivityOptOut)
        if (!studentId) continue
        if (exclude === undefined && inact === undefined) continue

        try {
          const data: any = {}
          if (exclude !== undefined) data.excludeFromParentReport = exclude
          if (inact !== undefined) data.inactivityOptOut = inact

          const updated = await prisma.parentStudent.update({
            where: { parentId_studentId: { parentId: userId, studentId } },
            data,
          })
          // non-fatal audit log
          prisma.auditLog.create({
            data: {
              adminId: userId,
              targetEntity: 'ParentStudent',
              targetId: updated.id,
              action: null,
              details: { action: 'update_parent_child_preferences', changes: data },
            },
          }).catch(() => {})

          updatedChildren.push({ id: studentId, excludeFromParentReport: updated.excludeFromParentReport, inactivityOptOut: updated.inactivityOptOut })
        } catch (err) {
          logger.warn('POST /api/parent/settings: update child preference failed', { parentId: userId, studentId, error: String(err) })
          continue
        }
      }
    }

    return NextResponse.json({ ok: true, profile: saved, updatedChildren })
  } catch (err) {
    logger.error('POST /api/parent/settings error', { className: 'api.parent.settings', methodName: 'POST', error: err })
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
