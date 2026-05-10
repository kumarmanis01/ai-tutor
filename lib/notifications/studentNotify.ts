/**
 * FILE OBJECTIVE:
 * - notifyStudentOnSessionComplete() -- sends session-complete celebration email
 *   and WhatsApp to the student after each completed learning session.
 * - Covers: session complete, mastery update, and practice performance celebration.
 * - Channels: email (student.email) + WhatsApp (student.whatsappPhone).
 * - Fire-and-forget: all errors are caught and logged; never throws.
 */

import { prisma } from '@/lib/prisma';
import { sendMailSafe } from '@/lib/mailer';
import { sendWhatsAppSafe } from '@/lib/whatsapp/sender';
import { logger } from '@/lib/logger';
import { sessionCompleteForStudentHtml } from '@/lib/email/templates';

const APP_URL = process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com';
const STUDENT_DASHBOARD_URL = `${APP_URL}/dashboard`;

export type StudentSessionCompleteNotifData = {
  xpEarned: number;
  totalXp: number;
  currentStreak: number;
  conceptName: string | null;
  masteryDelta: number;
  masteryAfter: number;
  accuracy: number;
  badgeNames: string[];
  sessionDurationMinutes: number;
  leveledUp: boolean;
  newLevel: number | null;
};

export async function notifyStudentOnSessionComplete(
  studentId: string,
  data: StudentSessionCompleteNotifData,
): Promise<void> {
  try {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { name: true, email: true, whatsappPhone: true },
    });

    if (!student) return;

    const studentName = student.name ?? 'there';

    if (student.email) {
      try {
        const html = sessionCompleteForStudentHtml({
          studentName,
          conceptName: data.conceptName,
          xpEarned: data.xpEarned,
          totalXp: data.totalXp,
          currentStreak: data.currentStreak,
          masteryDelta: data.masteryDelta,
          accuracy: data.accuracy,
          badgeNames: data.badgeNames,
          sessionDurationMinutes: data.sessionDurationMinutes,
          leveledUp: data.leveledUp,
          newLevel: data.newLevel,
          dashboardUrl: STUDENT_DASHBOARD_URL,
        });
        await sendMailSafe({
          to: student.email,
          subject: `Great session today, ${studentName}! +${data.xpEarned} XP`,
          html,
        });
      } catch (emailErr) {
        logger.error('[studentNotify] email send failed', {
          event: 'student_session_email_error',
          context: { studentId, error: String(emailErr) },
        });
      }
    }

    if (student.whatsappPhone) {
      try {
        const text = buildWhatsAppText(studentName, data);
        await sendWhatsAppSafe(student.whatsappPhone, text);
      } catch (waErr) {
        logger.error('[studentNotify] whatsapp send failed', {
          event: 'student_session_wa_error',
          context: { studentId, error: String(waErr) },
        });
      }
    }
  } catch (err) {
    logger.error('[studentNotify] notifyStudentOnSessionComplete failed', {
      event: 'student_session_notif_error',
      context: { studentId, error: String(err) },
    });
  }
}

function buildWhatsAppText(name: string, data: StudentSessionCompleteNotifData): string {
  const streakPart = data.currentStreak >= 2 ? ` ${data.currentStreak}-day streak!` : '';
  const badgePart = data.badgeNames.length > 0 ? ` Badge unlocked: ${data.badgeNames[0]}.` : '';
  const levelPart = data.leveledUp && data.newLevel ? ` Level ${data.newLevel} reached!` : '';
  return `Great session, ${name}! +${data.xpEarned} XP earned.${streakPart}${levelPart}${badgePart} Keep the momentum going on Spinzy Academy.`;
}
