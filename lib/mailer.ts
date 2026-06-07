/**
 * FILE OBJECTIVE:
 * - Compatibility shim that re-exports the canonical mail facade from
 *   `lib/mail.ts` under the historical `@/lib/mailer` path. Existing tests,
 *   workers and a small number of scripts still import `sendMailSafe` and
 *   friends from `@/lib/mailer`; rather than touch ~30 call sites we expose
 *   a thin, typed surface that delegates to `lib/mail.ts`.
 *
 * Public surface:
 *   - sendMail(opts)         strict send, throws on failure
 *   - sendMailSafe(opts)     best-effort send, logs + swallows errors
 *   - sendEmail(params)      passthrough to sendEmailUnified
 *   - sendEmailSafe(params)  passthrough to sendEmailUnifiedSafe
 *
 * Do not add business logic here -- keep it a re-export shim.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/mailer.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | initial creation with standard header.
 */

import { logger } from '@/lib/logger';
import {
  sendEmailUnified,
  sendEmailUnifiedSafe,
  type MailOptions,
  type UnifiedEmailSendParams,
  type SendEmailResult,
} from '@/lib/mail';

export type { MailOptions, UnifiedEmailSendParams, SendEmailResult };

export async function sendMail(opts: MailOptions): Promise<SendEmailResult> {
  return sendEmailUnified({
    delivery: 'strict',
    mode: 'raw',
    to: Array.isArray(opts.to) ? opts.to[0]! : opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    from: opts.from,
    idempotencyKey: opts.idempotencyKey,
  });
}

export async function sendMailSafe(opts: MailOptions): Promise<SendEmailResult | null> {
  try {
    return await sendEmailUnifiedSafe({
      delivery: 'best_effort',
      mode: 'raw',
      to: Array.isArray(opts.to) ? opts.to[0]! : opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      from: opts.from,
      idempotencyKey: opts.idempotencyKey,
    });
  } catch (err) {
    logger.error('[mailer] sendMailSafe failed', {
      event: 'mailer.sendMailSafe.error',
      context: { error: err instanceof Error ? err.message : String(err) },
    });
    return null;
  }
}

export const sendEmail = sendEmailUnified;
export const sendEmailSafe = sendEmailUnifiedSafe;
