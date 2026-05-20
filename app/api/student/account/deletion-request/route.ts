import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { sendEmailUnifiedSafe } from '@/lib/mail'
import { deletionConfirmHtml } from '@/lib/email/templates'
import { AdminActionType } from '@prisma/client'
import { invalidateUserSessionCache } from '@/lib/auth';

const DAYS_TO_PSEUDONYMISE = 7
const DAYS_TO_PURGE = 30

export async function POST() {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const userEmail = session.user.email ?? ''

  // Idempotent: return existing request if already submitted
  const existing = await prisma.deletionRequest.findUnique({ where: { userId } })
  if (existing) {
    const scheduledPseudonymiseDate = new Date(
      existing.requestedAt.getTime() + DAYS_TO_PSEUDONYMISE * 24 * 60 * 60 * 1000,
    )
    const scheduledPurgeDate = new Date(
      existing.requestedAt.getTime() + DAYS_TO_PURGE * 24 * 60 * 60 * 1000,
    )
    return NextResponse.json({
      requested: true,
      scheduledPseudonymiseDate: scheduledPseudonymiseDate.toISOString(),
      scheduledPurgeDate: scheduledPurgeDate.toISOString(),
      alreadyRequested: true,
    })
  }

  const now = new Date()
  const scheduledPseudonymiseDate = new Date(now.getTime() + DAYS_TO_PSEUDONYMISE * 24 * 60 * 60 * 1000)
  const scheduledPurgeDate = new Date(now.getTime() + DAYS_TO_PURGE * 24 * 60 * 60 * 1000)

  await prisma.$transaction([
    prisma.deletionRequest.create({ data: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { accountStatus: 'deletion_pending' } }),
    prisma.auditLog.create({
      data: {
        targetEntity: 'User',
        targetId: userId,
        action: AdminActionType.ERASURE_REQUEST,
      },
    }),
  ])

  // Best-effort: invalidate session cache so JWT reflects deletion_pending status
  try {
    await invalidateUserSessionCache((session.user as any)?.email);
  } catch {
    // swallow
  }

  // Send confirmation email (non-fatal)
  if (userEmail) {
    sendEmailUnifiedSafe({
      mode: 'raw',
      delivery: 'best_effort',
      to: userEmail,
      subject: 'Account deletion request received -- Spinzy Academy',
      html: deletionConfirmHtml(),
      reason: 'account_deletion_request',
      featureFlagDomain: 'notification',
    }).catch(() => undefined)
  }

  return NextResponse.json({
    requested: true,
    scheduledPseudonymiseDate: scheduledPseudonymiseDate.toISOString(),
    scheduledPurgeDate: scheduledPurgeDate.toISOString(),
  })
}
