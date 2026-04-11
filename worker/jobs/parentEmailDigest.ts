/**
 * FILE OBJECTIVE:
 * - Sends weekly email digest to parents summarizing their children's learning.
 * - Runs after weekly aggregation (Sunday 5 AM UTC).
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created parent email digest job
 * - 2026-02-04 | claude | integrated WhatsApp delivery alongside email
 * - 2026-04-09 | copilot | respect excludeFromParentReport when selecting parent links
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendMailSafe } from '@/lib/mailer';
import { sendWhatsAppMessage, buildWeeklyWhatsAppMessage } from '@/lib/whatsapp';
import { generateParentReportAI } from '@/lib/ai/tools/generateParentReport';
import { sendParentMilestoneNotification } from '@/lib/notifications/delivery';
import { t } from '@/lib/i18n';

/**
 * Send weekly email digest to all parents with active student links
 */
export async function sendParentDigests(): Promise<number> {
  // Find all parents with active links (exclude students opted out of parent reports)
  const parentLinks = await prisma.parentStudent.findMany({
    where: { status: 'active', excludeFromParentReport: false },
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
    // Skip if child is currently paused by parent
    if ((link as any).isPaused && (link as any).pausedUntil && new Date((link as any).pausedUntil) > new Date()) {
      logger.info('parentEmailDigest: skipping paused child', { parentId: link.parent.id, studentId: link.student.id, pausedUntil: (link as any).pausedUntil })
      continue
    }
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

  const lastWeekMonday = new Date(monday);
  lastWeekMonday.setUTCDate(lastWeekMonday.getUTCDate() - 7);

  // Collect every child ID across all parents for batch fetching
  const allChildIds = Object.values(parentMap).flatMap((p) => p.children.map((c) => c.id));

  // Batch-fetch all per-child data in 6 queries instead of 6N
  const [
    allSummaries,
    allLastWeekSummaries,
    allFlags,
    allReadiness,
    allStrengths,
    allStreaks,
  ] = await Promise.all([
    prisma.weeklyStudentSummary.findMany({
      where: { studentId: { in: allChildIds }, weekStart: monday },
    }),
    prisma.weeklyStudentSummary.findMany({
      where: { studentId: { in: allChildIds }, weekStart: lastWeekMonday },
    }),
    prisma.attentionFlag.findMany({
      where: { studentId: { in: allChildIds }, resolved: false },
    }),
    prisma.readinessStatus.findMany({
      where: { studentId: { in: allChildIds } },
      orderBy: { readinessScore: 'asc' },
    }),
    prisma.studentTopicMastery.findMany({
      where: {
        studentId: { in: allChildIds },
        masteryLevel: { in: ['advanced', 'expert'] },
        updatedAt: { gte: monday },
      },
    }),
    prisma.studentStreak.findMany({
      where: { studentId: { in: allChildIds }, kind: 'daily' },
    }),
  ]);

  // Build lookup maps keyed by studentId
  const summaryByStudent = new Map<string, (typeof allSummaries)[number]>(
    allSummaries.map((s) => [s.studentId, s]),
  );
  const lastWeekByStudent = new Map<string, (typeof allLastWeekSummaries)[number]>(
    allLastWeekSummaries.map((s) => [s.studentId, s]),
  );

  const flagsByStudent = new Map<string, typeof allFlags>();
  for (const f of allFlags) {
    const arr = flagsByStudent.get(f.studentId) ?? [];
    arr.push(f);
    flagsByStudent.set(f.studentId, arr);
  }

  const readinessByStudent = new Map<string, typeof allReadiness>();
  for (const r of allReadiness) {
    const arr = readinessByStudent.get(r.studentId) ?? [];
    arr.push(r);
    readinessByStudent.set(r.studentId, arr);
  }

  const strengthsByStudent = new Map<string, typeof allStrengths>();
  for (const s of allStrengths) {
    const arr = strengthsByStudent.get(s.studentId) ?? [];
    arr.push(s);
    strengthsByStudent.set(s.studentId, arr);
  }

  const streakByStudent = new Map<string, (typeof allStreaks)[number]>(
    allStreaks.map((s) => [s.studentId, s]),
  );

  let sentCount = 0;

  for (const [parentId, parent] of Object.entries(parentMap)) {
    try {
      // Respect parent digest preferences (opt-out and scheduled day)
      const profile = await prisma.parentProfile.findUnique({ where: { userId: parentId } })
      if (profile?.digestOptOut) {
        logger.info('parentEmailDigest: skipped due to opt-out', { parentId })
        continue
      }
      const parentTimezone = profile?.digestTimezone ?? (await prisma.user.findUnique({ where: { id: parentId }, select: { timezone: true } }))?.timezone
      const preferredDay = profile?.digestDay ?? 'Sunday'
      if (parentTimezone) {
        try {
          const localDay = new Date().toLocaleString('en-US', { timeZone: parentTimezone, weekday: 'long' })
          if (String(localDay).toLowerCase() !== String(preferredDay).toLowerCase()) {
            logger.info('parentEmailDigest: skipping parent due to preferredDay mismatch', { parentId, preferredDay, localDay })
            continue
          }
        } catch (err) {
          // If timezone invalid, fall back to sending
        }
      }

      const childSections: string[] = [];

      for (const child of parent.children) {
        const summary = summaryByStudent.get(child.id) ?? null;
        const lastWeekSummary = lastWeekByStudent.get(child.id) ?? null;
        const flags = (flagsByStudent.get(child.id) ?? []).slice(0, 5);
        const readiness = (readinessByStudent.get(child.id) ?? []).slice(0, 5);
        const newStrengths = (strengthsByStudent.get(child.id) ?? []).slice(0, 5);
        const streak = streakByStudent.get(child.id) ?? null;

        const trustSignals = buildTrustSignals(summary, lastWeekSummary, newStrengths, streak, flags);

        // Build AI-generated short paragraph for this child (best-effort)
        let aiParagraph = ''
        try {
          // Snake_case keys match the LLM tool schema contract defined in
          // lib/ai/tools/generateParentReport.ts (WeekSummaryInput).
          const weekSummary = {
            days_active: summary?.sessionsCount ?? 0,
            time_spent_min: summary?.totalMinutes ?? 0,
            improved_topics: newStrengths.map((s) => s.subject).slice(0, 3),
            struggling_topics: flags.map((f) => `${f.subject}${f.chapter ? ' / ' + f.chapter : ''}`).slice(0, 3),
            streak_days: streak?.current ?? 0,
            tests_taken: summary?.testsTaken ?? 0,
          }
          const ai = await generateParentReportAI(child.name, weekSummary as any, parent.language)
          aiParagraph = ai.summary
        } catch (err) {
          logger.warn('parentEmailDigest: AI paragraph generation failed', { parentId, childId: child.id, error: String(err) })
          aiParagraph = ''
        }

        childSections.push(buildChildSection(child, summary, flags, readiness, trustSignals, aiParagraph));
      }

      const html = buildDigestHtml(parent.name, childSections);
      const subject = t('digest.subject', undefined, parent.language)
      const text = t('digest.fallback_text', undefined, parent.language)
      // Use centralized notification helper which enforces caps for milestone emails
      await sendParentMilestoneNotification(parentId, { email: parent.email, phone: parent.phone ?? undefined, subject, html, text, meta: { type: 'digest', channel: 'email', locale: parent.language } })

      sentCount++;
      logger.info('parentEmailDigest: sent', { parentId, childCount: parent.children.length });

      // WhatsApp delivery (fire-and-forget, non-blocking) -- uses pre-fetched maps
      if (parent.phone && parent.children.length > 0) {
        const firstChild = parent.children[0];
        const waSummary = summaryByStudent.get(firstChild.id) ?? null;
        const waStrengths = strengthsByStudent.get(firstChild.id) ?? [];
        const waFlags = flagsByStudent.get(firstChild.id) ?? [];

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
    improvementTrend = 'First tracked week -- great start!';
  }

  // Strengths unlocked
  const strengthsUnlocked = newStrengths.map(
    (s) => `${s.subject} / ${s.chapter}`,
  );

  // Suggested action
  let suggestedAction = 'Keep encouraging regular study -- consistency is key!';
  if (flags.length > 0) {
    suggestedAction = 'Ask about the topics flagged above -- a quick chat can help build confidence.';
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
  aiParagraph?: string,
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
      return `<li style="margin:4px 0;color:#92400E;">${f.subject} / ${f.chapter} -- ${friendlyReason}</li>`;
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
      return `<li style="margin:4px 0;"><span style="color:${color};font-weight:bold;">${r.subject}</span>: ${r.readinessScore}% -- ${friendlyLabel}</li>`;
    }).join('');
    readinessHtml = `
      <div style="margin-top:12px;">
        <strong>Learning Insights:</strong>
        <ul style="margin:4px 0 0 16px;padding:0;">${readinessItems}</ul>
      </div>
    `;
  }

  // AI paragraph (short, parent-friendly) - injected above trust signals when available
  let aiHtml = ''
  if (aiParagraph && aiParagraph.trim()) {
    aiHtml = `<div style="margin-top:12px;padding:12px;background:#F8FAFC;border-radius:8px;border-left:3px solid #94A3B8;color:#334155;">${aiParagraph}</div>`
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
      ${aiHtml}
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
        <img src="https://spinzy.in/logos/logo-email.png" width="176" height="50" alt="Spinzy Academy" style="display:block;margin:0 auto">
        <p style="color:#6B7280;margin:8px 0 0;">Weekly Learning Summary</p>
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
