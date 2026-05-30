/**
 * PATCH /api/admin/content/subject-toggle
 *
 * Toggles the isEnabled flag on a BoardSubjectConfig row.
 * This is the admin-controlled visibility gate for student-facing subject availability.
 *
 * Body: { boardSubjectConfigId: string, isEnabled: boolean }
 * Auth: admin role required.
 * Returns: updated BoardSubjectConfig row (id, subjectDefId, isEnabled, enabledAt, enabledBy)
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function PATCH(req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { boardSubjectConfigId, isEnabled } = body as Record<string, unknown>

  if (typeof boardSubjectConfigId !== 'string' || !boardSubjectConfigId) {
    return NextResponse.json({ error: 'boardSubjectConfigId_required' }, { status: 400 })
  }
  if (typeof isEnabled !== 'boolean') {
    return NextResponse.json({ error: 'isEnabled_must_be_boolean' }, { status: 400 })
  }

  try {
    const existing = await prisma.boardSubjectConfig.findUnique({
      where: { id: boardSubjectConfigId },
      select: { id: true, isEnabled: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const updated = await prisma.boardSubjectConfig.update({
      where: { id: boardSubjectConfigId },
      data: {
        isEnabled,
        enabledAt: isEnabled ? new Date() : undefined,
        enabledBy: session.user.id,
      },
      select: {
        id: true,
        subjectDefId: true,
        isEnabled: true,
        enabledAt: true,
        enabledBy: true,
      },
    })

    logger.info('subject_toggle', {
      event: 'subject_toggle',
      context: {
        boardSubjectConfigId,
        isEnabled,
        adminId: session.user.id,
        previous: existing.isEnabled,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    logger.error('subject_toggle_error', { error: err, boardSubjectConfigId, isEnabled })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
