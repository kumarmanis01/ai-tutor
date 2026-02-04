/**
 * FILE OBJECTIVE:
 * - Sends weekly email digest to parents summarizing their children's learning.
 * - Runs after weekly aggregation (Sunday 5 AM UTC).
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created parent email digest job
 * - 2026-02-04 | claude | integrated WhatsApp delivery alongside email
 */

import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { sendEmail } from '../../lib/mailer.js';
import { sendWhatsAppMessage, buildWeeklyWhatsAppMessage } from '../../lib/whatsapp.js';

/**
 * Send weekly email digest to all parents with active student links
 */
export async function sendParentDigests(): Promise<number> {
  // Find all parents with active links
  const parentLinks = await prisma.parentStudent.findMany({
    where: { status: 'active' },
    include: {
      parent: { select: { id: true, email: true, name: true, phone: true, language: true } },
      student: { select: { id: true, name: true, grade: true, board: true } },
    },
  });

  // Group by parent
  const parentMap: Record<string, {
    email: string;
    name: string;
    phone: string | null;
    language: string;
    children: { id: string; name: string; grade: string | null; board: string | null }[];
  }> = {};

  for (const link of parentLinks) {
    if (!link.parent.email) continue;
    if (!parentMap[link.parent.id]) {
      parentMap[link.parent.id] = {
        email: link.parent.email,
        name: link.parent.name || 'Parent',
        phone: link.parent.phone || null,
        language: link.parent.language || 'en',
        children: [],
      };
    }
    parentMap[link.parent.id].children.push({
      id: link.student.id,
      name: link.student.name || 'Student',
      grade: link.student.grade,
      board: link.student.board,
    });
  }

  // Calculate current week boundaries
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setUTCHours(0, 0, 0, 0);

  let sentCount = 0;

  for (const [parentId, parent] of Object.entries(parentMap)) {
    try {
      const childSections: string[] = [];

      for (const child of parent.children) {
        // Fetch weekly summary
        const summary = await prisma.weeklyStudentSummary.findUnique({
          where: { studentId_weekStart: { studentId: child.id, weekStart: monday } },
        });

        // Fetch attention flags
        const flags = await prisma.attentionFlag.findMany({
          where: { studentId: child.id, resolved: false },
          take: 5,
        });

        // Fetch readiness
        const readiness = await prisma.readinessStatus.findMany({
          where: { studentId: child.id },
          orderBy: { readinessScore: 'asc' },
          take: 5,
        });

        // Fetch last week's summary for improvement trend
        const lastWeekMonday = new Date(monday);
        lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);
        const lastWeekSummary = await prisma.weeklyStudentSummary.findUnique({
          where: { studentId_weekStart: { studentId: child.id, weekStart: lastWeekMonday } },
        });

        // Fetch newly mastered topics this week (strengths unlocked)
        const newStrengths = await prisma.studentTopicMastery.findMany({
          where: {
            studentId: child.id,
            masteryLevel: { in: ['advanced', 'expert'] },
            updatedAt: { gte: monday },
          },
          take: 5,
        });

        // Fetch streak data
        const streak = await prisma.studentStreak.findFirst({
          where: { studentId: child.id, kind: 'daily' },
        });

        const trustSignals = buildTrustSignals(summary, lastWeekSummary, newStrengths, streak, flags);
        childSections.push(buildChildSection(child, summary, flags, readiness, trustSignals));
      }

      const html = buildDigestHtml(parent.name, childSections);
      const text = `Weekly Learning Summary for your children on Spinzy Academy.`;

      await sendEmail({
        to: parent.email,
        subject: `Weekly Learning Summary - Spinzy Academy`,
        html,
        text,
      });

      sentCount++;
      logger.info('parentEmailDigest: sent', { parentId, childCount: parent.children.length });

      // WhatsApp delivery (fire-and-forget, non-blocking)
      if (parent.phone && parent.children.length > 0) {
        const firstChild = parent.children[0];
        const waSummary = await prisma.weeklyStudentSummary.findUnique({
          where: { studentId_weekStart: { studentId: firstChild.id, weekStart: monday } },
        });

        // Derive improved/struggling from mastery data
        const waStrengths = await prisma.studentTopicMastery.findMany({
          where: { studentId: firstChild.id, masteryLevel: { in: ['advanced', 'expert'] }, updatedAt: { gte: monday } },
          take: 1,
          select: { subject: true },
        });
        const waFlags = await prisma.attentionFlag.findMany({
          where: { studentId: firstChild.id, resolved: false },
          take: 1,
          select: { subject: true },
        });

        const whatsappMsg = buildWeeklyWhatsAppMessage(
          parent.name,
          firstChild.name,
          waSummary?.sessionsCount ?? 0,
          waStrengths[0]?.subject ?? null,
          waFlags[0]?.subject ?? null,
          parent.language,
        );

        sendWhatsAppMessage(parent.phone, whatsappMsg, parentId).catch((err) => {
          logger.warn('parentEmailDigest: whatsapp failed', { parentId, error: String(err) });
        });
      }
    } catch (err) {
      logger.error('parentEmailDigest: failed for parent', {
        parentId,
        error: String(err),
      });
    }
  }

  logger.info('parentEmailDigest: completed', { totalSent: sentCount });
  return sentCount;
}

interface TrustSignals {
  improvementTrend: string | null;
  strengthsUnlocked: string[];
  streakDays: number;
  suggestedAction: string;
}

function buildTrustSignals(
  summary: any | null,
  lastWeek: any | null,
  newStrengths: { subject: string; chapter: string }[],
  streak: { current: number } | null,
  flags: any[],
): TrustSignals {
  // Improvement trend
  let improvementTrend: string | null = null;
  if (summary && lastWeek) {
    const scoreDiff = (summary.averageScore ?? 0) - (lastWeek.averageScore ?? 0);
    const minutesDiff = (summary.totalMinutes ?? 0) - (lastWeek.totalMinutes ?? 0);
    if (scoreDiff > 5) {
      improvementTrend = `Score improved by ${Math.round(scoreDiff)}% compared to last week`;
    } else if (minutesDiff > 30) {
      improvementTrend = `${minutesDiff} more minutes of study time than last week`;
    } else if (summary.topicsCovered > (lastWeek.topicsCovered ?? 0)) {
      improvementTrend = `Covered ${summary.topicsCovered - lastWeek.topicsCovered} more topics than last week`;
    }
  } else if (summary && !lastWeek) {
    improvementTrend = 'First tracked week — great start!';
  }

  // Strengths unlocked
  const strengthsUnlocked = newStrengths.map(
    (s) => `${s.subject} / ${s.chapter}`,
  );

  // Suggested action
  let suggestedAction = 'Keep encouraging regular study — consistency is key!';
  if (flags.length > 0) {
    suggestedAction = 'Ask about the topics flagged above — a quick chat can help build confidence.';
  } else if (strengthsUnlocked.length > 0) {
    suggestedAction = `Celebrate the new strengths unlocked this week! Positive recognition boosts motivation.`;
  } else if (streak && streak.current >= 5) {
    suggestedAction = `${streak.current}-day streak! A small reward for consistency can reinforce the habit.`;
  }

  return {
    improvementTrend,
    strengthsUnlocked,
    streakDays: streak?.current ?? 0,
    suggestedAction,
  };
}

function buildChildSection(
  child: { name: string; grade: string | null; board: string | null },
  summary: any | null,
  flags: any[],
  readiness: any[],
  trustSignals?: TrustSignals,
): string {
  const gradeLabel = child.grade ? `Class ${child.grade}` : '';
  const boardLabel = child.board || '';
  const subtitle = [gradeLabel, boardLabel].filter(Boolean).join(' • ');

  let statsHtml = '<p style="color:#666;">No activity recorded this week.</p>';
  if (summary) {
    statsHtml = `
      <table style="width:100%;border-collapse:collapse;margin:8px 0;">
        <tr>
          <td style="padding:8px;text-align:center;background:#EEF2FF;border-radius:8px;">
            <div style="font-size:24px;font-weight:bold;color:#4F46E5;">${summary.topicsCovered}</div>
            <div style="font-size:12px;color:#666;">Topics</div>
          </td>
          <td style="padding:8px;text-align:center;background:#F0FDF4;border-radius:8px;">
            <div style="font-size:24px;font-weight:bold;color:#16A34A;">${summary.testsTaken}</div>
            <div style="font-size:12px;color:#666;">Tests</div>
          </td>
          <td style="padding:8px;text-align:center;background:#FEF3C7;border-radius:8px;">
            <div style="font-size:24px;font-weight:bold;color:#D97706;">${summary.totalMinutes}m</div>
            <div style="font-size:12px;color:#666;">Study Time</div>
          </td>
          <td style="padding:8px;text-align:center;background:#FDF2F8;border-radius:8px;">
            <div style="font-size:24px;font-weight:bold;color:#DB2777;">${Math.round(summary.averageScore)}%</div>
            <div style="font-size:12px;color:#666;">Avg Score</div>
          </td>
        </tr>
      </table>
    `;
  }

  let flagsHtml = '';
  if (flags.length > 0) {
    const flagItems = flags.map((f) => {
      const friendlyReason = f.reason === 'very_low_accuracy' ? 'developing skills'
        : f.reason === 'low_mastery' ? 'room to grow'
        : 'needs a little more support';
      return `<li style="margin:4px 0;color:#92400E;">${f.subject} / ${f.chapter} — ${friendlyReason}</li>`;
    }).join('');
    flagsHtml = `
      <div style="margin-top:12px;padding:12px;background:#FFFBEB;border-radius:8px;">
        <strong style="color:#92400E;">These topics may need a bit more practice:</strong>
        <ul style="margin:4px 0 0 16px;padding:0;">${flagItems}</ul>
      </div>
    `;
  }

  let readinessHtml = '';
  if (readiness.length > 0) {
    const readinessItems = readiness.map((r) => {
      const color = r.readinessLabel === 'ready' ? '#16A34A' :
                    r.readinessLabel === 'on_track' ? '#D97706' :
                    r.readinessLabel === 'needs_work' ? '#92400E' : '#666';
      const friendlyLabel = r.readinessLabel === 'ready' ? 'looking great'
        : r.readinessLabel === 'on_track' ? 'making progress'
        : r.readinessLabel === 'needs_work' ? 'developing skills' : 'just getting started';
      return `<li style="margin:4px 0;"><span style="color:${color};font-weight:bold;">${r.subject}</span>: ${r.readinessScore}% — ${friendlyLabel}</li>`;
    }).join('');
    readinessHtml = `
      <div style="margin-top:12px;">
        <strong>Learning Insights:</strong>
        <ul style="margin:4px 0 0 16px;padding:0;">${readinessItems}</ul>
      </div>
    `;
  }

  // Trust signals section
  let trustHtml = '';
  if (trustSignals) {
    const parts: string[] = [];

    // Improvement trend
    if (trustSignals.improvementTrend) {
      parts.push(`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:18px;">📈</span>
          <span style="color:#16A34A;font-weight:500;">${trustSignals.improvementTrend}</span>
        </div>
      `);
    }

    // Streak
    if (trustSignals.streakDays > 0) {
      parts.push(`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:18px;">🔥</span>
          <span style="color:#D97706;font-weight:500;">${trustSignals.streakDays}-day learning streak!</span>
        </div>
      `);
    }

    // Strengths unlocked
    if (trustSignals.strengthsUnlocked.length > 0) {
      const items = trustSignals.strengthsUnlocked
        .map((s) => `<li style="margin:2px 0;color:#16A34A;">${s}</li>`)
        .join('');
      parts.push(`
        <div style="margin-bottom:8px;">
          <span style="font-size:14px;font-weight:500;">✨ New strengths unlocked:</span>
          <ul style="margin:4px 0 0 16px;padding:0;">${items}</ul>
        </div>
      `);
    }

    // Suggested parent action
    parts.push(`
      <div style="margin-top:8px;padding:10px;background:#EEF2FF;border-radius:8px;border-left:3px solid #4F46E5;">
        <span style="font-size:13px;color:#4F46E5;font-weight:600;">💡 Tip for you:</span>
        <p style="margin:4px 0 0;font-size:13px;color:#4338CA;">${trustSignals.suggestedAction}</p>
      </div>
    `);

    trustHtml = `
      <div style="margin-top:12px;padding:12px;background:#F0FDF4;border-radius:8px;">
        <strong style="color:#166534;margin-bottom:8px;display:block;">This Week's Highlights</strong>
        ${parts.join('')}
      </div>
    `;
  }

  return `
    <div style="border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin-bottom:16px;">
      <h3 style="margin:0 0 4px 0;color:#1F2937;">${child.name}</h3>
      ${subtitle ? `<p style="margin:0 0 12px 0;color:#6B7280;font-size:14px;">${subtitle}</p>` : ''}
      ${statsHtml}
      ${trustHtml}
      ${flagsHtml}
      ${readinessHtml}
    </div>
  `;
}

function buildDigestHtml(parentName: string, childSections: string[]): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1F2937;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="margin:0;color:#4F46E5;">Spinzy Academy</h1>
        <p style="color:#6B7280;margin:4px 0 0;">Weekly Learning Summary</p>
      </div>

      <p>Hi ${parentName},</p>
      <p>Here's how learning went this week:</p>

      ${childSections.join('')}

      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #E5E7EB;text-align:center;">
        <a href="${process.env.NEXTAUTH_URL || 'https://spinzyacademy.com'}/parent" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">View Full Dashboard</a>
      </div>

      <p style="color:#9CA3AF;font-size:12px;text-align:center;margin-top:24px;">
        You're receiving this because you have linked student accounts on Spinzy Academy.
      </p>
    </body>
    </html>
  `;
}
