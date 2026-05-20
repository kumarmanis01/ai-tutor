/**
 * FILE OBJECTIVE:
 * - Shared transactional email utilities built on Resend, including safe wrappers
 *   and operational alert helpers used by recommendation and worker flows.
 *
 * LINKED UNIT TEST:
 * - __tests__/lib/mailer.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EMAIL INFRA POLICY: All email sends must use lib/mail.ts (sendEmailUnified, sendEmailUnifiedSafe). sendMail must call sendEmailUnified; sendMailSafe must call sendEmailUnifiedSafe. No direct Resend SDK usage.
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | add throttled topic-ranker missing-concept email alert helper
 * - 2026-05-20T00:00:00Z | copilot | refactor: route sendMail to sendEmailUnified and sendMailSafe to sendEmailUnifiedSafe (centralized infra)
 */
import { sendEmailUnified, sendEmailUnifiedSafe } from '@/lib/mail';
import { createHash } from 'crypto';
import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import {
  MAILER_NO_REPLY_EMAIL,
  MAILER_TOPIC_RANKER_ALERT_EMAIL,
} from '@/lib/email/functionalityEmails';

const TOPIC_RANKER_ALERT_RECIPIENT = MAILER_TOPIC_RANKER_ALERT_EMAIL;
const TOPIC_RANKER_ALERT_TTL_SECONDS = 4 * 60 * 60;
const TOPIC_RANKER_ALERT_TOPIC_SAMPLE_LIMIT = 20;

// Lazy singleton -- avoids crash at module load time when RESEND_API_KEY is absent
// (e.g. during Next.js build or unit tests that do not exercise email).
let _client: Resend | null = null;
function getClient(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error(
        '[mailer] RESEND_API_KEY not set. Add to .env.production and ecosystem.config.cjs',
      );
    }
    _client = new Resend(key);
  }
  return _client;
}

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: string | Buffer; // Buffer will be base64-encoded for the provider
    contentType?: string;
  }>;
}

/**
 * Send email via Resend. Throws on failure.
 * Returns the Resend message ID for logging/audit.
 * Use sendMailSafe() in workers where you don't want email failure
 * to crash the job.
 */
export async function sendMail(opts: MailOptions): Promise<string> {
  // Route all direct sends through centralized email infra
  const result = await sendEmailUnified({
    mode: 'raw',
    delivery: 'strict',
    to: Array.isArray(opts.to) ? opts.to[0] : opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
    cc: opts.cc,
    attachments: opts.attachments,
    reason: 'legacy_mailer',
  });
  if (!result.success) throw new Error(result.error || 'sendMail failed');
  return result.messageId || '';
}

/**
 * Fire-and-forget wrapper. Never throws.
 * Safe for BullMQ workers, cron jobs, and webhooks.
 */
export async function sendMailSafe(opts: MailOptions): Promise<void> {
  // Route all safe sends through centralized email infra
  await sendEmailUnifiedSafe({
    mode: 'raw',
    delivery: 'best_effort',
    to: Array.isArray(opts.to) ? opts.to[0] : opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
    cc: opts.cc,
    attachments: opts.attachments,
    reason: 'legacy_mailer',
  });
}

// Alias kept for backwards compatibility with existing call sites.
export const sendEmail = sendMailSafe;

export interface TopicRankerCoverageAlert {
  studentId: string;
  frontierSize: number;
  rankableFrontierSize: number;
  filteredTopicIds: string[];
}

function makeTopicRankerAlertDedupKey(filteredTopicIds: string[]): string {
  const normalized = [...new Set(filteredTopicIds)].sort().join('|');
  const digest = createHash('sha1').update(normalized).digest('hex');
  return `alerts:topic-ranker:missing-active-concept:${digest}`;
}

async function isTopicRankerAlertSuppressed(filteredTopicIds: string[]): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const dedupKey = makeTopicRankerAlertDedupKey(filteredTopicIds);
  const setResult = await (redis as any).set(dedupKey, '1', 'EX', TOPIC_RANKER_ALERT_TTL_SECONDS, 'NX');
  return !setResult;
}

export async function sendTopicRankerCoverageAlertSafe(
  alert: TopicRankerCoverageAlert,
): Promise<void> {
  const filtered = [...new Set(alert.filteredTopicIds)].filter(Boolean);
  if (filtered.length === 0) return;

  try {
    const suppressed = await isTopicRankerAlertSuppressed(filtered);
    if (suppressed) {
      logger.info('[mailer] topic-ranker coverage alert suppressed by dedupe window', {
        studentId: alert.studentId,
        filteredTopicCount: filtered.length,
      });
      return;
    }

    const sampledTopicIds = filtered.slice(0, TOPIC_RANKER_ALERT_TOPIC_SAMPLE_LIMIT);
    const extraTopicCount = Math.max(0, filtered.length - sampledTopicIds.length);
    const subject = `Spinzy alert: topic ranking skipped ${filtered.length} non-startable topic(s)`;
    const text = [
      'Topic ranker filtered frontier topics because no active concepts were available.',
      '',
      `Student ID: ${alert.studentId}`,
      `Frontier size: ${alert.frontierSize}`,
      `Rankable frontier size: ${alert.rankableFrontierSize}`,
      `Filtered topic count: ${filtered.length}`,
      '',
      'Filtered topic IDs:',
      ...sampledTopicIds.map((topicId) => `- ${topicId}`),
      ...(extraTopicCount > 0 ? [`- ...and ${extraTopicCount} more`] : []),
    ].join('\n');
    const html = `
      <p><strong>Topic ranker filtered frontier topics</strong></p>
      <p>No active concepts were available for one or more frontier topics.</p>
      <ul>
        <li><strong>Student ID:</strong> ${alert.studentId}</li>
        <li><strong>Frontier size:</strong> ${alert.frontierSize}</li>
        <li><strong>Rankable frontier size:</strong> ${alert.rankableFrontierSize}</li>
        <li><strong>Filtered topic count:</strong> ${filtered.length}</li>
      </ul>
      <p><strong>Filtered topic IDs</strong></p>
      <ul>
        ${sampledTopicIds.map((topicId) => `<li>${topicId}</li>`).join('')}
      </ul>
      ${extraTopicCount > 0 ? `<p>...and ${extraTopicCount} more</p>` : ''}
    `;

    await sendMailSafe({
      to: TOPIC_RANKER_ALERT_RECIPIENT,
      subject,
      text,
      html,
    });

    logger.warn('[mailer] topic-ranker coverage alert sent', {
      to: TOPIC_RANKER_ALERT_RECIPIENT,
      studentId: alert.studentId,
      filteredTopicCount: filtered.length,
      frontierSize: alert.frontierSize,
      rankableFrontierSize: alert.rankableFrontierSize,
    });
  } catch (err) {
    logger.error('[mailer] topic-ranker coverage alert failed', {
      studentId: alert.studentId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
