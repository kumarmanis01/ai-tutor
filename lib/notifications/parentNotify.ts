/**
 * FILE OBJECTIVE:
 * - notifyParent(studentId, event, data) -- central dispatcher for parent notifications.
 * - Resolves parent contact from the student record (parentEmail + whatsappPhone/parentPhone).
 * - Sends email via sendMailSafe and WhatsApp via sendWhatsAppSafe for every event.
 * - Called from workers/listeners after diagnostic complete, plan generated,
 *   session complete, session missed, and auth (welcome) events.
 * - Channels: email + WhatsApp only. No SMS.
 */

import { prisma } from '@/lib/prisma';
import { sendMailSafe } from '@/lib/mailer';
import { sendWhatsAppSafe } from '@/lib/whatsapp/sender';
import { logger } from '@/lib/logger';
import {
  MAIL_FROM,
  MAIL_SUBJECTS,
  PARENT_NOTIF_EVENTS,
  formatSubject,
  type ParentNotifEvent,
} from '@/lib/constants/mail';
import {
  diagnosticCompleteForParentHtml,
  planGeneratedForParentHtml,
  sessionCompleteForParentHtml,
} from '@/lib/email/templates';

type DiagnosticCompleteData = {
  subjectName: string;
  placement: string;
  dashboardUrl: string;
};

type PlanGeneratedData = {
  subjectName: string;
  dashboardUrl: string;
};

type SessionCompleteData = {
  topicName: string;
  subjectName: string;
  sessionDate: string;
  dashboardUrl: string;
};

type SessionMissedData = {
  dashboardUrl: string;
};

type NotifyData =
  | { event: typeof PARENT_NOTIF_EVENTS.AUTH; data?: Record<string, never> }
  | { event: typeof PARENT_NOTIF_EVENTS.DIAGNOSTIC_COMPLETE; data: DiagnosticCompleteData }
  | { event: typeof PARENT_NOTIF_EVENTS.PLAN_GENERATED; data: PlanGeneratedData }
  | { event: typeof PARENT_NOTIF_EVENTS.SESSION_COMPLETE; data: SessionCompleteData }
  | { event: typeof PARENT_NOTIF_EVENTS.SESSION_MISSED; data: SessionMissedData };

const APP_URL = process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com';

export async function notifyParent(
  studentId: string,
  eventPayload: NotifyData,
): Promise<void> {
  try {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { name: true, parentEmail: true, parentPhone: true, whatsappPhone: true },
    });

    if (!student) return;

    const parentEmail = student.parentEmail?.trim() ?? '';
    const whatsappPhone = (student.whatsappPhone ?? student.parentPhone ?? '').trim();
    const studentName = student.name ?? 'your child';

    if (!parentEmail && !whatsappPhone) return;

    const { event } = eventPayload;

    if (parentEmail) {
      await sendEmailForEvent(event, studentName, parentEmail, eventPayload);
    }

    if (whatsappPhone) {
      await sendWhatsAppForEvent(event, studentName, whatsappPhone, eventPayload);
    }
  } catch (err) {
    logger.error('[parentNotify] failed to notify parent', {
      className: 'parentNotify',
      methodName: 'notifyParent',
      studentId,
      error: String((err as Error)?.message ?? err),
    });
  }
}

async function sendEmailForEvent(
  event: ParentNotifEvent,
  studentName: string,
  parentEmail: string,
  payload: NotifyData,
): Promise<void> {
  try {
    let subject: string;
    let html: string;

    if (event === PARENT_NOTIF_EVENTS.DIAGNOSTIC_COMPLETE) {
      const d = (payload as { event: string; data: DiagnosticCompleteData }).data;
      subject = formatSubject(MAIL_SUBJECTS.DIAGNOSTIC_COMPLETE, studentName);
      html = diagnosticCompleteForParentHtml({
        parentName: 'there',
        studentName,
        subjectName: d.subjectName,
        placement: d.placement,
        dashboardUrl: d.dashboardUrl,
      });
    } else if (event === PARENT_NOTIF_EVENTS.PLAN_GENERATED) {
      const d = (payload as { event: string; data: PlanGeneratedData }).data;
      subject = formatSubject(MAIL_SUBJECTS.PLAN_GENERATED, studentName);
      html = planGeneratedForParentHtml({
        parentName: 'there',
        studentName,
        subjectName: d.subjectName,
        dashboardUrl: d.dashboardUrl,
      });
    } else if (event === PARENT_NOTIF_EVENTS.SESSION_COMPLETE) {
      const d = (payload as { event: string; data: SessionCompleteData }).data;
      subject = formatSubject(MAIL_SUBJECTS.SESSION_COMPLETE, studentName);
      html = sessionCompleteForParentHtml({
        parentName: 'there',
        studentName,
        topicName: d.topicName,
        subjectName: d.subjectName,
        sessionDate: d.sessionDate,
        dashboardUrl: d.dashboardUrl,
      });
    } else if (event === PARENT_NOTIF_EVENTS.SESSION_MISSED) {
      const d = (payload as { event: string; data: SessionMissedData }).data;
      subject = formatSubject(MAIL_SUBJECTS.SESSION_MISSED, studentName);
      html = buildSessionMissedHtml(studentName, d.dashboardUrl);
    } else {
      // AUTH / welcome -- no separate parent email for auth event (student gets magic link)
      return;
    }

    await sendMailSafe({ from: MAIL_FROM, to: parentEmail, subject, html });
  } catch (err) {
    logger.error('[parentNotify] email send failed', {
      className: 'parentNotify',
      methodName: 'sendEmailForEvent',
      event,
      error: String((err as Error)?.message ?? err),
    });
  }
}

async function sendWhatsAppForEvent(
  event: ParentNotifEvent,
  studentName: string,
  whatsappPhone: string,
  payload: NotifyData,
): Promise<void> {
  // WhatsApp messages use approved templates via Meta Cloud API.
  // For events without an approved template yet, we fall back to a short text
  // message (valid only within the 24-hour customer-service window).
  try {
    let text: string;

    if (event === PARENT_NOTIF_EVENTS.DIAGNOSTIC_COMPLETE) {
      const d = (payload as { event: string; data: DiagnosticCompleteData }).data;
      text = `${studentName} completed their ${d.subjectName} diagnostic on Spinzy Academy. Placement: ${d.placement}. View progress: ${d.dashboardUrl}`;
    } else if (event === PARENT_NOTIF_EVENTS.PLAN_GENERATED) {
      const d = (payload as { event: string; data: PlanGeneratedData }).data;
      text = `${studentName}'s personalised ${d.subjectName} learning plan is ready on Spinzy Academy. See the plan: ${d.dashboardUrl}`;
    } else if (event === PARENT_NOTIF_EVENTS.SESSION_COMPLETE) {
      const d = (payload as { event: string; data: SessionCompleteData }).data;
      text = `Great news! ${studentName} completed a ${d.subjectName} session on ${d.sessionDate}. Keep up the momentum: ${d.dashboardUrl}`;
    } else if (event === PARENT_NOTIF_EVENTS.SESSION_MISSED) {
      const d = (payload as { event: string; data: SessionMissedData }).data;
      text = `Give ${studentName} a nudge -- they have not had a session recently on Spinzy Academy. ${d.dashboardUrl}`;
    } else {
      return;
    }

    await sendWhatsAppSafe(whatsappPhone, text);
  } catch (err) {
    logger.error('[parentNotify] whatsapp send failed', {
      className: 'parentNotify',
      methodName: 'sendWhatsAppForEvent',
      event,
      error: String((err as Error)?.message ?? err),
    });
  }
}

function buildSessionMissedHtml(studentName: string, dashboardUrl: string): string {
  const base = [
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;',
    'max-width:520px;margin:0 auto;color:#1a1a1a;padding:0 8px;',
  ].join('');
  const btn = [
    'display:inline-block;padding:12px 28px;background:#534AB7;',
    'color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;',
  ].join('');
  return `
    <div style="${base}">
      <h2 style="color:#BA7517;">Give ${studentName} a nudge</h2>
      <p>Hi there,</p>
      <p>${studentName} has not completed a learning session recently on Spinzy Academy.
         A quick reminder from you can go a long way -- consistent daily sessions build
         exam confidence faster than cramming.</p>
      <a href="${dashboardUrl}" style="${btn}">View progress</a>
      <p style="color:#888;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
        Spinzy Academy -- AI Home Tutor<br>
        You are receiving this because you have a Spinzy account.
      </p>
    </div>
  `;
}

export const DEFAULT_DASHBOARD_URL = `${APP_URL}/parent/dashboard`;
