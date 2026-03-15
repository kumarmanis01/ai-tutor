/**
 * Distress notification worker — T43 prep (ENABLE_DISTRESS_DETECTION=false)
 *
 * BullMQ processor for 'distress-notification' queue.
 *
 * If ENABLE_DISTRESS_DETECTION !== 'true': skips silently and returns.
 * If enabled:
 *   1. Creates a SafetyEvent row (type='DISTRESS')
 *   2. Looks up the linked parent for the student
 *   3. If no parent: marks SafetyEvent for admin review and logs CRITICAL
 *   4. If parent found: sends a warm support email with helpline numbers
 *
 * Never throws — all errors are caught and logged.
 */

import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'
import { sendEmail } from '@/lib/mailer.js'
import type { DistressNotificationJobData } from '../../jobs/distressNotification.js'

function buildParentEmailHtml(params: {
  childName: string
  severity: string
}): string {
  const { childName } = params
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1F2937;">
  <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:20px;margin-bottom:20px;">
    <h2 style="margin:0 0 4px;color:#1D4ED8;font-size:18px;">A note about ${childName}</h2>
    <p style="margin:0;color:#1E40AF;font-size:13px;">We noticed something during a recent study session.</p>
  </div>

  <p>Hi,</p>

  <p>During a recent learning session, ${childName} expressed feelings that suggest they may be going through a difficult time. We wanted to let you know so you can check in with them.</p>

  <p>You know your child best. A gentle conversation — even just asking how they're feeling today — can make a big difference.</p>

  <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin:20px 0;">
    <p style="margin:0 0 8px;font-weight:600;color:#166534;">Support resources (India):</p>
    <p style="margin:4px 0;color:#15803D;">📞 iCall: <strong>9152987821</strong></p>
    <p style="margin:4px 0;color:#15803D;">📞 Vandrevala Foundation: <strong>1860-2662-345</strong> (24x7)</p>
    <p style="margin:4px 0;font-size:12px;color:#6B7280;">Both are free, confidential, and available in multiple Indian languages.</p>
  </div>

  <p>If you have any concerns or would like to speak with our team, please reply to this email.</p>

  <p style="color:#6B7280;font-size:11px;margin-top:24px;">
    This message was sent by Spinzy's automated wellbeing monitoring system.
    Student messages are not shared verbatim to protect privacy.
  </p>
</body>
</html>`
}

export async function processDistressNotification(
  job: Job<DistressNotificationJobData>,
): Promise<void> {
  const { studentId, sessionId, turnId, severity, triggerPhrases, studentMessage } = job.data

  // Gate: skip if flag is off (code ready but not yet live)
  if (process.env.ENABLE_DISTRESS_DETECTION !== 'true') {
    logger.info('distressNotification.skipped', { reason: 'flag_off', studentId, severity })
    return
  }

  try {
    // 1. Create SafetyEvent row
    const safetyEvent = await prisma.safetyEvent.create({
      data: {
        triggerType: 'DISTRESS',
        severity,
        studentId,
        sessionId: sessionId || null,
        turnId: turnId || null,
        // Never store verbatim — store trigger phrase list only
        inputPreview: triggerPhrases.join(', ').slice(0, 200),
      },
    })

    // 2. Look up linked parent
    const parentLink = await prisma.parentStudent.findFirst({
      where: { studentId, status: 'active' },
      select: {
        parent: { select: { name: true, email: true } },
        student: { select: { name: true } },
      },
    })

    // 3. No parent linked → flag for admin review
    if (!parentLink?.parent?.email) {
      await prisma.safetyEvent.update({
        where: { id: safetyEvent.id },
        data: { resolution: 'no_parent_linked_admin_review_required' },
      })
      logger.error('distressNotification.noParent', {
        studentId,
        severity,
        message: 'CRITICAL: distress detected but no parent linked — admin must review',
        safetyEventId: safetyEvent.id,
      })
      return
    }

    // 4. Send warm support email to parent
    const childName = parentLink.student?.name ?? 'your child'
    const parentEmail = parentLink.parent.email

    await sendEmail({
      to: parentEmail,
      subject: `Important: ${childName} may need support`,
      html: buildParentEmailHtml({ childName, severity }),
      text: [
        `Hi,`,
        ``,
        `During a recent learning session, ${childName} expressed feelings that suggest they may be going through a difficult time.`,
        `We wanted to let you know so you can check in with them.`,
        ``,
        `Support resources (India):`,
        `iCall: 9152987821`,
        `Vandrevala Foundation: 1860-2662-345 (24x7, free, confidential)`,
        ``,
        `If you have concerns, please reply to this email.`,
        ``,
        `– Spinzy Team`,
      ].join('\n'),
    })

    logger.info('distressNotification.sent', {
      studentId,
      severity,
      safetyEventId: safetyEvent.id,
      parentEmail,
    })
  } catch (err) {
    logger.error('distressNotification.error', {
      studentId,
      severity,
      error: err instanceof Error ? err.message : String(err),
    })
    // Never rethrow — student-facing response must not be affected
  }
}
