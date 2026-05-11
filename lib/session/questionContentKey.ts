/**
 * Shared question content-key utilities for within-session deduplication.
 *
 * Used by getPhaseContent.ts (Practice / Test) and homework.ts so that
 * identical question text is detected across all three session phases even
 * when the same question exists in both the Question table and the
 * GeneratedQuestion table under different row IDs.
 *
 * Accepts both field-name shapes:
 *   Question table:          { prompt, choices, correctAnswer }
 *   GeneratedQuestion table: { question, options, answer }
 */

export type QuestionForKey = {
  prompt?: string | null;
  question?: string | null;
  choices?: unknown;
  options?: unknown;
  correctAnswer?: unknown;
  answer?: unknown;
};

function normalizeText(input: unknown): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableValue).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${k}:${stableValue(obj[k])}`)
      .join(',')}}`;
  }
  if (typeof value === 'string') {
    return normalizeText(value);
  }
  return String(value ?? '');
}

/**
 * Build a stable, normalized content key that is identical for two questions
 * if and only if they have the same prompt text, options, and correct answer
 * (case- and whitespace-insensitive).
 *
 * Works for both Question and GeneratedQuestion field shapes.
 */
export function buildQuestionContentKey(q: QuestionForKey): string {
  const text = normalizeText(q.prompt ?? q.question);
  const opts = stableValue(q.choices ?? q.options);
  const ans = stableValue(q.correctAnswer ?? q.answer);
  return `${text}::${opts}::${ans}`;
}
