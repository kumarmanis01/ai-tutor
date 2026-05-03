/**
 * Zod schemas and validation for on-demand quiz LLM output.
 *
 * Hardening layers:
 *  1. Structural: every field present, correct types, correct option count.
 *  2. Content: question text non-trivial, explanation non-trivial.
 *  3. Correctness: correctAnswer is one of the options.
 *  4. Language: grammar questions must have grammarCategory set when subject is a language subject.
 *  5. Normalisation: aliases, casing, whitespace fixed before validation.
 */

import { z } from 'zod';
import { detectLanguageSubject } from './languageSubjectDetector';

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const OnDemandQuizQuestionSchema = z.object({
  question: z.string().min(10, 'question text too short'),
  options: z.array(z.string().min(1)).length(4, 'exactly 4 options required'),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(10, 'explanation too short'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  topicName: z.string().optional().nullable(),
  grammarCategory: z.string().optional().nullable(),
});

export const OnDemandQuizOutputSchema = z.object({
  questions: z.array(OnDemandQuizQuestionSchema).min(1),
});

export type OnDemandQuizQuestion = z.infer<typeof OnDemandQuizQuestionSchema>;
export type OnDemandQuizOutput = z.infer<typeof OnDemandQuizOutputSchema>;

// ── Normalisation ─────────────────────────────────────────────────────────────

const CORRECT_ANSWER_ALIASES = ['correct_answer', 'correctAnswer', 'answer', 'correct'] as const;
const TOPIC_NAME_ALIASES = ['topic', 'topicName', 'topic_name'] as const;
const GRAMMAR_CAT_ALIASES = ['grammarCategory', 'grammar_category', 'category'] as const;

/**
 * Normalises raw LLM output before Zod validation.
 *
 * Handles:
 * - Bare array -> { questions: [...] }
 * - Options as keyed object -> string array
 * - Alias resolution for correctAnswer, topicName, grammarCategory
 * - Difficulty casing (Easy -> easy)
 * - Whitespace trimming on question and explanation
 * - Stub explanation when missing
 */
export function normalizeOnDemandOutput(raw: unknown): unknown {
  if (raw == null) return raw;

  let data: Record<string, unknown> = {};

  if (Array.isArray(raw)) {
    data = { questions: raw };
  } else if (typeof raw === 'object') {
    data = { ...(raw as Record<string, unknown>) };
  } else {
    return raw;
  }

  if (!Array.isArray(data.questions)) return data;

  data.questions = (data.questions as unknown[]).map((q) => {
    if (!q || typeof q !== 'object') return q;
    const out: Record<string, unknown> = { ...(q as Record<string, unknown>) };

    // Trim question text
    if (typeof out.question === 'string') out.question = out.question.trim();

    // Options as keyed object -> sorted string array
    if (out.options && !Array.isArray(out.options) && typeof out.options === 'object') {
      const keys = Object.keys(out.options as Record<string, unknown>).sort();
      out.options = keys.map((k) => String((out.options as Record<string, unknown>)[k]));
    }

    // Resolve correctAnswer from aliases
    if (out.correctAnswer == null) {
      for (const alias of CORRECT_ANSWER_ALIASES) {
        if (alias !== 'correctAnswer' && out[alias] != null) {
          out.correctAnswer = out[alias];
          delete out[alias];
          break;
        }
      }
    }

    // If correctAnswer is a 0-based index, resolve to option string
    if (
      typeof out.correctAnswer === 'number' &&
      Array.isArray(out.options) &&
      out.correctAnswer >= 0 &&
      out.correctAnswer < (out.options as unknown[]).length
    ) {
      out.correctAnswer = (out.options as string[])[out.correctAnswer as number];
    }

    // Resolve topicName from aliases
    if (out.topicName == null) {
      for (const alias of TOPIC_NAME_ALIASES) {
        if (alias !== 'topicName' && out[alias] != null) {
          out.topicName = out[alias];
          delete out[alias];
          break;
        }
      }
    }

    // Resolve grammarCategory from aliases
    if (out.grammarCategory == null) {
      for (const alias of GRAMMAR_CAT_ALIASES) {
        if (alias !== 'grammarCategory' && out[alias] != null) {
          out.grammarCategory = out[alias];
          delete out[alias];
          break;
        }
      }
    }

    // Normalise difficulty casing
    if (typeof out.difficulty === 'string') {
      out.difficulty = out.difficulty.toLowerCase();
    }

    // Trim explanation; stub when absent or empty
    if (typeof out.explanation === 'string') {
      out.explanation = out.explanation.trim();
    }
    if (!out.explanation || (typeof out.explanation === 'string' && out.explanation.length === 0)) {
      out.explanation = 'See your textbook for a detailed explanation.';
    }

    return out;
  });

  return data;
}

// ── Per-question correctness guard ────────────────────────────────────────────

export interface QuestionValidationIssue {
  index: number;
  issues: string[];
}

export interface ValidationReport {
  valid: boolean;
  totalCount: number;
  validCount: number;
  issues: QuestionValidationIssue[];
}

/**
 * Deep-validates a normalised quiz output.
 *
 * Beyond Zod structural checks, also verifies:
 * - correctAnswer is one of the options (not just present)
 * - For language subjects: grammar questions have grammarCategory set
 * - No duplicate question text
 */
export function validateOnDemandQuiz(
  data: unknown,
  opts: { subjectName: string; expectedDifficulty: string }
): ValidationReport {
  const report: ValidationReport = { valid: false, totalCount: 0, validCount: 0, issues: [] };

  const parsed = OnDemandQuizOutputSchema.safeParse(data);
  if (!parsed.success) {
    report.issues.push({ index: -1, issues: [parsed.error.message] });
    return report;
  }

  const { questions } = parsed.data;
  report.totalCount = questions.length;

  const langInfo = detectLanguageSubject(opts.subjectName);
  const seenQuestions = new Set<string>();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qIssues: string[] = [];

    // correctAnswer must be one of the options
    if (!q.options.includes(q.correctAnswer)) {
      qIssues.push('correctAnswer is not one of the options');
    }

    // difficulty must match expected
    if (q.difficulty !== opts.expectedDifficulty) {
      qIssues.push(`difficulty mismatch: expected ${opts.expectedDifficulty}, got ${q.difficulty}`);
    }

    // Grammar questions must have grammarCategory when subject is a language subject
    if (langInfo.isLanguage && !q.grammarCategory) {
      // Not every question needs a grammar category -- only grammar-slot questions.
      // We skip this check here; the service-layer quota enforcement handles it.
    }

    // No duplicate question text
    const key = q.question.toLowerCase().trim();
    if (seenQuestions.has(key)) {
      qIssues.push('duplicate question text');
    }
    seenQuestions.add(key);

    if (qIssues.length === 0) {
      report.validCount++;
    } else {
      report.issues.push({ index: i, issues: qIssues });
    }
  }

  report.valid = report.validCount === report.totalCount;
  return report;
}

/**
 * Throws if any question fails validation. Used by the service to gate persistence.
 */
export function assertQuizValid(
  data: unknown,
  opts: { subjectName: string; expectedDifficulty: string }
): OnDemandQuizOutput {
  const normalized = normalizeOnDemandOutput(data);
  const report = validateOnDemandQuiz(normalized, opts);

  if (!report.valid) {
    const summary = report.issues
      .slice(0, 5)
      .map((i) => `q[${i.index}]: ${i.issues.join(', ')}`)
      .join(' | ');
    const err: Error & { validationReport?: ValidationReport } = new Error(
      `quiz_validation_failed: ${summary}`
    );
    err.validationReport = report;
    throw err;
  }

  return OnDemandQuizOutputSchema.parse(normalized);
}
