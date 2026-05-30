/**
 * FILE OBJECTIVE:
 * - Read yesterday's SlowQueryLog rows, compute summary stats, and email a digest
 *   to the on-call admin via Resend.
 *
 * CALLED BY:
 * - worker/scheduler.ts daily at 00:30 UTC (6:00 AM IST)
 *
 * CONTRACTS:
 * - Never throws -- all errors caught and re-logged
 * - Never logs PII -- model/operation/durationMs only
 * - Never awaits fire-and-forget paths (all awaits here are intentional)
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendEmailUnifiedSafe } from '@/lib/mail';

const SLOW_QUERY_DIGEST_RETENTION_DAYS = 30;
const SLOW_QUERY_DIGEST_TOP_N = 10;

interface SlowQuerySummary {
  totalCount: number;
  uniqueOperations: number;
  p95DurationMs: number;
  maxDurationMs: number;
  topOperations: Array<{ model: string | null; operation: string; count: number; maxMs: number; avgMs: number }>;
}

async function buildSummary(since: Date, until: Date): Promise<SlowQuerySummary> {
  const rows = await prisma.slowQueryLog.findMany({
    where: { createdAt: { gte: since, lt: until } },
    select: { model: true, operation: true, durationMs: true },
    orderBy: { durationMs: 'desc' },
  });

  if (rows.length === 0) {
    return { totalCount: 0, uniqueOperations: 0, p95DurationMs: 0, maxDurationMs: 0, topOperations: [] };
  }

  const durations = rows.map((r) => r.durationMs).sort((a, b) => a - b);
  const p95Index = Math.floor(durations.length * 0.95);
  const p95DurationMs = durations[p95Index] ?? durations[durations.length - 1] ?? 0;
  const maxDurationMs = durations[durations.length - 1] ?? 0;

  // Group by (model, operation)
  const groupMap = new Map<string, { model: string | null; operation: string; count: number; maxMs: number; sumMs: number }>();
  for (const row of rows) {
    const key = `${row.model ?? ''}::${row.operation}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.count += 1;
      existing.sumMs += row.durationMs;
      if (row.durationMs > existing.maxMs) existing.maxMs = row.durationMs;
    } else {
      groupMap.set(key, { model: row.model, operation: row.operation, count: 1, maxMs: row.durationMs, sumMs: row.durationMs });
    }
  }

  const topOperations = Array.from(groupMap.values())
    .sort((a, b) => b.count - a.count || b.maxMs - a.maxMs)
    .slice(0, SLOW_QUERY_DIGEST_TOP_N)
    .map((g) => ({ model: g.model, operation: g.operation, count: g.count, maxMs: g.maxMs, avgMs: Math.round(g.sumMs / g.count) }));

  return {
    totalCount: rows.length,
    uniqueOperations: groupMap.size,
    p95DurationMs,
    maxDurationMs,
    topOperations,
  };
}

function buildHtml(date: string, summary: SlowQuerySummary): string {
  const tableRows = summary.topOperations.map((op) =>
    `<tr>
      <td style="padding:4px 8px;border:1px solid #ddd">${op.model ?? '(none)'}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${op.operation}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${op.count}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${op.avgMs} ms</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${op.maxMs} ms</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#333;max-width:700px;margin:0 auto">
  <h2>Slow Query Digest &mdash; ${date}</h2>
  <table style="border-collapse:collapse;width:100%;margin-bottom:16px">
    <tr>
      <td style="padding:8px;background:#f5f5f5;font-weight:bold">Total slow queries</td>
      <td style="padding:8px">${summary.totalCount}</td>
    </tr>
    <tr>
      <td style="padding:8px;background:#f5f5f5;font-weight:bold">Unique operation keys</td>
      <td style="padding:8px">${summary.uniqueOperations}</td>
    </tr>
    <tr>
      <td style="padding:8px;background:#f5f5f5;font-weight:bold">p95 duration</td>
      <td style="padding:8px">${summary.p95DurationMs} ms</td>
    </tr>
    <tr>
      <td style="padding:8px;background:#f5f5f5;font-weight:bold">Max duration</td>
      <td style="padding:8px">${summary.maxDurationMs} ms</td>
    </tr>
  </table>
  ${summary.topOperations.length > 0 ? `
  <h3>Top ${summary.topOperations.length} operations by frequency</h3>
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    <thead>
      <tr style="background:#f0f0f0">
        <th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Model</th>
        <th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Operation</th>
        <th style="padding:4px 8px;border:1px solid #ddd;text-align:right">Count</th>
        <th style="padding:4px 8px;border:1px solid #ddd;text-align:right">Avg</th>
        <th style="padding:4px 8px;border:1px solid #ddd;text-align:right">Max</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>` : '<p>No slow queries recorded for this period.</p>'}
  <p style="color:#888;font-size:12px;margin-top:24px">Spinzy AI Tutor &mdash; automated daily report. Threshold: 500 ms.</p>
</body>
</html>`;
}

function buildText(date: string, summary: SlowQuerySummary): string {
  const lines = [
    `Slow Query Digest -- ${date}`,
    `Total slow queries: ${summary.totalCount}`,
    `Unique operation keys: ${summary.uniqueOperations}`,
    `p95 duration: ${summary.p95DurationMs} ms`,
    `Max duration: ${summary.maxDurationMs} ms`,
    '',
    'Top operations by frequency:',
  ];
  for (const op of summary.topOperations) {
    lines.push(`  ${op.model ?? '(none)'}::${op.operation}  count=${op.count}  avg=${op.avgMs}ms  max=${op.maxMs}ms`);
  }
  if (summary.topOperations.length === 0) lines.push('  (none)');
  return lines.join('\n');
}

export async function runSlowQueryDigest(): Promise<{ sent: boolean; totalCount: number }> {
  const oncallEmail = process.env.ONCALL_EMAIL;
  if (!oncallEmail) {
    logger.warn('slowQueryDigest.skipped', { reason: 'ONCALL_EMAIL not set' });
    return { sent: false, totalCount: 0 };
  }

  const now = new Date();
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); // start of today UTC
  const since = new Date(until.getTime() - 24 * 60 * 60 * 1000); // 24 h window = yesterday UTC
  const dateLabel = since.toISOString().slice(0, 10);

  const summary = await buildSummary(since, until);

  await sendEmailUnifiedSafe({
    mode: 'raw',
    delivery: 'best_effort',
    to: oncallEmail,
    subject: `[Spinzy] Slow Query Digest ${dateLabel} (${summary.totalCount} events)`,
    html: buildHtml(dateLabel, summary),
    text: buildText(dateLabel, summary),
    reason: 'slow_query_digest',
    featureFlagDomain: 'ops',
  });

  // Purge rows older than retention window to keep the table bounded
  const retentionCutoff = new Date(now.getTime() - SLOW_QUERY_DIGEST_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count: purged } = await prisma.slowQueryLog.deleteMany({ where: { createdAt: { lt: retentionCutoff } } });

  logger.info('slowQueryDigest.completed', { date: dateLabel, totalCount: summary.totalCount, purged });
  return { sent: true, totalCount: summary.totalCount };
}
