/**
 * Distress notification worker -- T43 prep (ENABLE_DISTRESS_DETECTION=false)
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
 * Never throws -- all errors are caught and logged.
 */

import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'
import { sendEmailUnified } from '@/lib/mail.js'
import { distressNotificationParentHtml } from '@/lib/email/templates'
import type { DistressNotificationJobData } from '../../jobs/distressNotification.js'

// Uses templates.distressNotificationParentHtml

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
        // Never store verbatim -- store trigger phrase list only
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
        message: 'CRITICAL: distress detected but no parent linked -- admin must review',
        safetyEventId: safetyEvent.id,
      })
      return
    }

    // 4. Send warm support email to parent
    const childName = parentLink.student?.name ?? 'your child'
    const parentEmail = parentLink.parent.email

    // sendEmailUnified with delivery: 'strict' -- distress alerts must never be silently dropped
    await sendEmailUnified({
      mode: 'raw',
      delivery: 'strict',
      to: parentEmail,
      subject: `Important: ${childName} may need support`,
      // TODO(email-consolidation): this bypasses sendEmailUnified -- migrate to EMAIL_TEMPLATES catalog
      html: distressNotificationParentHtml({ childName, severity }),
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
        `- Spinzy Team`,
      ].join('\n'),
      reason: 'distress_notification',
      featureFlagDomain: 'ops',
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
    // Never rethrow -- student-facing response must not be affected
  }
}
