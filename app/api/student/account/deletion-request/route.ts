import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { sendEmail } from '@/lib/mailer'
import { AdminActionType } from '@prisma/client'

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

  // Send confirmation email (non-fatal)
  if (userEmail) {
    sendEmail({
      to: userEmail,
      subject: 'Your data deletion request — Spinzy',
      html: `<p>We've received your request. Your account has been deactivated.</p>
<p>Your personal data will be anonymised within 7 days and permanently deleted within 30 days.</p>
<p>Learning analytics are retained anonymously as required by law.</p>`,
      text: [
        "We've received your request. Your account has been deactivated.",
        'Your personal data will be anonymised within 7 days and permanently deleted within 30 days.',
        'Learning analytics are retained anonymously as required by law.',
      ].join('\n'),
    }).catch(() => undefined)
  }

  return NextResponse.json({
    requested: true,
    scheduledPseudonymiseDate: scheduledPseudonymiseDate.toISOString(),
    scheduledPurgeDate: scheduledPurgeDate.toISOString(),
  })
}
