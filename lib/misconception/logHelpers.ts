/**
 * FILE OBJECTIVE:
 * - Provide a safe helper to normalise and redact free-text student answers
 *   before they are stored or logged as part of novel-misconception analytics.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/misconception/logHelpers.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-14T00:00:00Z | copilot | created normalizeStudentAnswerForLogging
 */

import { logger } from '@/lib/logger';
import { redactPIIFromText } from '@/lib/ai/piiRedaction';

/**
 * Normalise whitespace, truncate, and redact PII from a student's free-text
 * answer before it is logged or persisted for analytics. This function is
 * defensive and will never throw.
 */
export function normalizeStudentAnswerForLogging(raw: unknown, maxLength = 1000): string {
  try {
    const s = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);

    // Collapse all whitespace to single spaces and trim edges
    const collapsed = s.replace(/\s+/g, ' ').trim();

    // Truncate to the configured max length
    const truncated = collapsed.length > maxLength ? collapsed.slice(0, maxLength) : collapsed;

    // Redact PII using the project's canonical redaction utility
    const redacted = redactPIIFromText(truncated);
    return typeof redacted === 'string' ? redacted : String(redacted ?? '');
  } catch (err) {
    // Defensive fallback: log the error and return a minimally-masked snippet.
    try {
      logger.error('normalizeStudentAnswerForLogging:redaction_failed', {
        error: (err as Error)?.message,
      });
    } catch {
      // swallow logger failures
    }

    // Basic masking: replace digits with # and obfuscate email-like tokens
    const fallback = (raw == null ? '' : String(raw))
      .replace(/\d/g, '#')
      .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, '[EMAIL]');
    const collapsed = fallback.replace(/\s+/g, ' ').trim();
    return collapsed.length > maxLength ? collapsed.slice(0, maxLength) : collapsed;
  }
}

export default normalizeStudentAnswerForLogging;
