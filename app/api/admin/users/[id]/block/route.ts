import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { AdminActionType } from '@prisma/client'
import { logApiUsage } from '@/utils/logApiUsage'

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await context.params

  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { accountStatus: 'suspended' } }),
      prisma.auditLog.create({
        data: {
          adminId: session.user.id,
          targetEntity: 'User',
          targetId: id,
          action: AdminActionType.ACCOUNT_SUSPEND,
        },
      }),
    ])
    logApiUsage(`/api/admin/users/${id}/block`, 'POST')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
