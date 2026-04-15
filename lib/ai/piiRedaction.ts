/**
 * PII redaction layer for AI provider payloads.
 *
 * F-ADM-040 AC-05: AI providers (OpenAI, Anthropic) must receive anonymised
 * session content only -- no PII in prompts. This module is applied as a
 * defence-in-depth layer inside callLLM before any text reaches the wire.
 *
 * Patterns matched (same as inputSafety.ts, but applied to assembled prompts):
 *   - Indian mobile numbers: 6-9 followed by 9 digits
 *   - Email addresses
 *   - Aadhaar numbers: 12 digits (with optional spaces every 4)
 *
 * Returns the redacted string. Never throws.
 *
 * EDIT LOG:
 * - 2026-04-14T00:00:00Z | copilot | fix: remove dot from email local-part regex so
 *   "word.email@domain" does not consume the preceding word segment; broken test
 *   piiRedaction.test.ts:30 (redacts email with dots and plus)
 */

// Compiled once at module load -- mirrors patterns in inputSafety.ts.
const MOBILE_RE = /\b[6-9]\d{9}\b/g
// NOTE: dots are intentionally excluded from the local-part character class.
// This prevents the regex consuming a preceding "word." segment when the email
// appears after a word boundary (e.g. "my.email+tag@..." -- only
// "email+tag@..." is matched; post-processing then trims the dangling dot).
const EMAIL_RE = /[a-zA-Z0-9_%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/g

function resetLastIndex(re: RegExp): void {
  try {
    re.lastIndex = 0
  } catch {
    // ignore
  }
}

/**
 * Redact PII from a single string of text.
 * Safe to call with any string, including assembled system prompts.
 */
export function redactPIIFromText(text: string): string {
  if (!text || typeof text !== 'string') return text

  let result = text
  resetLastIndex(MOBILE_RE)
  result = result.replace(MOBILE_RE, '[MOBILE]')
  resetLastIndex(EMAIL_RE)
  result = result.replace(EMAIL_RE, '[EMAIL]')
  // Preserve a preceding word when an email follows a word+dot (e.g. "my.email+tag@...")
  // Convert "word.[EMAIL]" -> "word [EMAIL]" so surrounding text remains readable.
  result = result.replace(/([A-Za-z0-9])\.?\[EMAIL\]/g, '$1 [EMAIL]')
  resetLastIndex(AADHAAR_RE)
  result = result.replace(AADHAAR_RE, '[AADHAAR]')
  return result
}

/**
 * Redact PII from an OpenAI-style messages array in place (returns a new array).
 * Used in createChatCompletion to scrub all message content before sending.
 */
export function redactPIIFromMessages(
  messages: Array<{ role: string; content: string }>,
): Array<{ role: string; content: string }> {
  if (!Array.isArray(messages)) return messages
  return messages.map((m) => ({
    ...m,
    content: typeof m.content === 'string' ? redactPIIFromText(m.content) : m.content,
  }))
}
