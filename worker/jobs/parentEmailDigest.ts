/**
 * FILE OBJECTIVE:
 * - Sends weekly email digest to parents summarizing their children's learning.
 * - Runs after weekly aggregation (Sunday 5 AM UTC).
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created parent email digest job
 */

import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { sendEmail } from '../../lib/mailer.js';

/**
 * Send weekly email digest to all parents with active student links
 */
export async function sendParentDigests(): Promise<number> {
  // Find all parents with active links
  const parentLinks = await prisma.parentStudent.findMany({
    where: { status: 'active' },
    include: {
      parent: { select: { id: true, email: true, name: true } },
      student: { select: { id: true, name: true, grade: true, board: true } },
    },
  });

  // Group by parent
  const parentMap: Record<string, {
    email: string;
    name: string;
    children: { id: string; name: string; grade: string | null; board: string | null }[];
  }> = {};

  for (const link of parentLinks) {
    if (!link.parent.email) continue;
    if (!parentMap[link.parent.id]) {
      parentMap[link.parent.id] = {
        email: link.parent.email,
        name: link.parent.name || 'Parent',
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

        childSections.push(buildChildSection(child, summary, flags, readiness));
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

function buildChildSection(
  child: { name: string; grade: string | null; board: string | null },
  summary: any | null,
  flags: any[],
  readiness: any[],
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

  return `
    <div style="border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin-bottom:16px;">
      <h3 style="margin:0 0 4px 0;color:#1F2937;">${child.name}</h3>
      ${subtitle ? `<p style="margin:0 0 12px 0;color:#6B7280;font-size:14px;">${subtitle}</p>` : ''}
      ${statsHtml}
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
