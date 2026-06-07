import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { AdminActionType } from '@prisma/client'
import { logApiUsage } from '@/utils/logApiUsage'

/**
 * DELETE /api/admin/parents/[parentId]/unlink?studentId=xxx
 * Removes the ParentStudent link between the parent and a specific student.
 * Requires ?studentId query param. Does not delete either user account.
 */
export async function DELETE(req: Request, context: { params: Promise<{ parentId: string }> }) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { parentId } = await context.params
  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId')

  if (!studentId) {
    return NextResponse.json({ error: 'studentId_required' }, { status: 400 })
  }

  try {
    const link = await prisma.parentStudent.findFirst({
      where: { parentId, studentId },
      select: { id: true },
    })

    if (!link) {
      return NextResponse.json({ error: 'link_not_found' }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.parentStudent.delete({ where: { id: link.id } }),
      prisma.auditLog.create({
        data: {
          adminId: session.user.id,
          targetEntity: 'ParentStudent',
          targetId: link.id,
          action: AdminActionType.ACCOUNT_SUSPEND,
          previousValue: { parentId, studentId },
          newValue: { deleted: true },
        },
      }),
    ])

    logApiUsage(`/api/admin/parents/${parentId}/unlink`, 'DELETE')
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
