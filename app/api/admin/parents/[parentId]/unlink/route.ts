/**
 * FILE OBJECTIVE:
 * - DELETE /api/admin/parents/[parentId]/unlink?studentId=xxx
 *   Removes the ParentStudent link between a parent and a specific student.
 *   Does not delete either user account.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/parents/[parentId]/unlink/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-07 | claude | created
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { logApiUsage } from '@/utils/logApiUsage'

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
    // Use the @@unique([parentId, studentId]) compound key for a precise lookup.
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select: { id: true },
    })

    if (!link) {
      return NextResponse.json({ error: 'link_not_found' }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.parentStudent.delete({ where: { id: link.id } }),
      // action is null (non-admin system event); operation detail recorded in newValue.
      prisma.auditLog.create({
        data: {
          adminId: session.user.id,
          targetEntity: 'ParentStudent',
          targetId: link.id,
          action: null,
          newValue: { operation: 'unlink', parentId, studentId },
        },
      }),
    ])

    logApiUsage(`/api/admin/parents/${parentId}/unlink`, 'DELETE')
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
