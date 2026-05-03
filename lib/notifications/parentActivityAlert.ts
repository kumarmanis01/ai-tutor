/**
 * FILE OBJECTIVE:
 * - Fire-and-forget parent notification when a student completes a topic session or quiz.
 * - Looks up the linked active parent for the given student.
 * - Uses the existing sendParentMilestoneNotification delivery layer (email + WhatsApp).
 * - Safe to call from any API route: all errors are swallowed after logging.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/notifications/parentActivityAlert.spec.ts
 *
 * EDIT LOG:
 * - 2026-05-03 | claude | created for gamify-topics-parent-alerts task
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendParentMilestoneNotification } from '@/lib/notifications/delivery';

export type ActivityAlertType = 'session_completed' | 'topic_completed' | 'quiz_completed';

export interface ActivityAlertPayload {
  studentId: string;
  activityType: ActivityAlertType;
  topicName?: string;
  subjectName?: string;
  /** Score 0-100, used only for quiz_completed */
  scorePercent?: number;
  xpEarned?: number;
  sessionDurationMinutes?: number;
}

/**
 * Notify the student's parent after a meaningful activity completion.
 * Fire-and-forget: never throws, never blocks the caller.
 */
export async function notifyParentOnActivity(payload: ActivityAlertPayload): Promise<void> {
  try {
    // Look up active parent link
    const link = await prisma.parentStudent.findFirst({
      where: { studentId: payload.studentId, status: 'active' },
      select: {
        parentId: true,
        inactivityOptOut: true,
        parent: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            parentProfile: {
              select: {
                digestOptOut: true,
              },
            },
          },
        },
      },
    });

    if (!link) return;

    const parent = link.parent;

    // Respect opt-outs
    if (link.inactivityOptOut) return;
    if (link.parent.parentProfile?.digestOptOut) return;

    const student = await prisma.user.findUnique({
      where: { id: payload.studentId },
      select: { name: true },
    });

    const studentName = student?.name ?? 'your child';
    const parentName = parent.name ?? 'Parent';

    const { subject, html, text } = buildActivityEmailContent({
      parentName,
      studentName,
      ...payload,
    });

    // Non-blocking: errors logged in delivery layer
    await sendParentMilestoneNotification(parent.id, {
      email: parent.email ?? undefined,
      whatsappPhone: parent.phone ?? undefined,
      subject,
      html,
      text,
      meta: {
        studentId: payload.studentId,
        type: 'milestone',
      },
    });
  } catch (err) {
    // Never propagate -- this is a best-effort alert
    logger.error('[parentActivityAlert] failed', {
      studentId: payload.studentId,
      activityType: payload.activityType,
      error: String(err),
    });
  }
}

// ── Email content builders ──────────────────────────────────────────────────

interface EmailContentInput extends ActivityAlertPayload {
  parentName: string;
  studentName: string;
}

function buildActivityEmailContent(opts: EmailContentInput): {
  subject: string;
  html: string;
  text: string;
} {
  const { parentName, studentName, activityType, topicName, subjectName, scorePercent, xpEarned, sessionDurationMinutes } = opts;

  const PRIMARY = '#534AB7';
  const PRIMARY_BG = '#EEEDFE';

  let heading = '';
  let detail = '';
  let emoji = '';

  if (activityType === 'quiz_completed') {
    emoji = '🎯';
    heading = `${studentName} completed a quiz!`;
    const score = typeof scorePercent === 'number' ? `${scorePercent}%` : null;
    const topicPart = topicName ? ` on <strong>${topicName}</strong>` : '';
    const scorePart = score ? ` with a score of <strong>${score}</strong>` : '';
    detail = `${studentName} just finished a quiz${topicPart}${scorePart}.`;
  } else if (activityType === 'topic_completed') {
    emoji = '🌟';
    heading = `${studentName} completed a topic!`;
    const topicPart = topicName ? `<strong>${topicName}</strong>` : 'a new topic';
    const subjectPart = subjectName ? ` in ${subjectName}` : '';
    detail = `${studentName} has finished studying ${topicPart}${subjectPart}.`;
  } else {
    emoji = '📚';
    heading = `${studentName} finished a study session!`;
    const topicPart = topicName ? ` on <strong>${topicName}</strong>` : '';
    const timePart =
      typeof sessionDurationMinutes === 'number' && sessionDurationMinutes > 0
        ? ` (${sessionDurationMinutes} min)`
        : '';
    detail = `${studentName} just completed a study session${topicPart}${timePart}.`;
  }

  const xpLine =
    typeof xpEarned === 'number' && xpEarned > 0
      ? `<p style="font-size:14px;color:#534AB7;margin:8px 0 0;">+${xpEarned} XP earned! Keep it up 🚀</p>`
      : '';

  const subject = `${emoji} ${heading} -- Spinzy Academy`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:${PRIMARY};padding:20px 28px;">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Spinzy Academy</p>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 4px;font-size:13px;color:#888888;">Hi ${parentName},</p>
          <h2 style="margin:0 0 16px;font-size:20px;color:#1a1a1a;">${emoji} ${heading}</h2>
          <div style="background:${PRIMARY_BG};border-radius:12px;padding:16px 20px;margin-bottom:16px;">
            <p style="margin:0;font-size:15px;color:#333333;">${detail}</p>
            ${xpLine}
          </div>
          <p style="font-size:13px;color:#666666;margin:0 0 20px;">
            Keep encouraging ${studentName} to study regularly -- every session builds lasting understanding. 🌱
          </p>
          <a href="${process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'}/dashboard"
             style="display:inline-block;background:${PRIMARY};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">
            View Progress
          </a>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #f0f0f0;">
          <p style="margin:0;font-size:11px;color:#aaaaaa;">
            Spinzy Academy &mdash; AI-powered tutor for Indian students.
            <br>You are receiving this because you are linked as a parent on this account.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textLines: string[] = [
    `Hi ${parentName},`,
    '',
    `${emoji} ${heading}`,
    '',
    detail.replace(/<[^>]+>/g, ''),
    typeof xpEarned === 'number' && xpEarned > 0 ? `+${xpEarned} XP earned!` : '',
    '',
    `Keep encouraging ${studentName} to study regularly -- every session builds lasting understanding.`,
    '',
    `View progress: ${process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'}/dashboard`,
    '',
    '-- Spinzy Academy',
  ].filter((l) => l !== undefined) as string[];

  return { subject, html, text: textLines.join('\n') };
}
