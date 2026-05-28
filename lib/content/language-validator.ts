/**
 * FILE OBJECTIVE:
 * - Post-generation guard that rejects LLM output containing English in non-English fields.
 * - Layer 3 of the three-layer language enforcement stack (prompt + code + validator).
 * - Throws before DB write; BullMQ retries the job with the enforcing prompt.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/content/language-validator.spec.ts
 */

const CONTENT_FIELDS = [
  'question', 'options', 'answer', 'explanation',
  'front', 'back', 'title', 'description', 'summary',
] as const;

function latinCharRatio(text: string): number {
  if (!text) return 0;
  const latin = (text.match(/[a-zA-Z]/g) ?? []).length;
  return latin / text.length;
}

/**
 * Assert that the given content object does not contain English in
 * non-English fields. Throws a descriptive error on violation so the
 * calling worker can dead-letter or retry the LLM job.
 *
 * @param content - Top-level content record (question, note, etc.)
 * @param contentLanguageCode - BCP-47 code resolved by resolveContentLanguage
 * @param threshold - Latin-char ratio above which a field is flagged (default 0.35)
 */
export function assertContentLanguage(
  content: Record<string, unknown>,
  contentLanguageCode: string,
  threshold = 0.35,
): void {
  if (contentLanguageCode === 'en') return;

  for (const field of CONTENT_FIELDS) {
    const value = content[field];
    if (!value) continue;

    const text = Array.isArray(value) ? value.join(' ') : String(value);
    const ratio = latinCharRatio(text);

    if (ratio > threshold) {
      throw new Error(
        `Language violation: field "${field}" contains ${Math.round(ratio * 100)}% ` +
        `Latin characters but contentLanguage is "${contentLanguageCode}". ` +
        `Value: "${text.slice(0, 80)}..."`,
      );
    }
  }
}
