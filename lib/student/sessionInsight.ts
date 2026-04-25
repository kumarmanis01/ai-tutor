import { callTutorLLM } from '@/lib/callLLM';
import { stripTag } from '@/lib/ai/tutor/tagParser';

const INSIGHT_TIMEOUT_MS = 5_000;

const FALLBACK_INSIGHT =
  "Great effort this session -- keep going and you'll see steady improvement!";

export interface SessionInsightParams {
  correctAnswers: number;
  totalQuestions: number;
  conceptName: string | null;
  hintsUsed: number;
  masteryDelta: number;
  studentId: string;
  sessionId: string;
}

/**
 * Generate a personalised, AI-written one-sentence closing insight for a
 * completed tutoring session.
 *
 * Rules enforced in the prompt:
 * - Exactly one sentence, max 25 words
 * - Specific to the session data -- not a generic "well done"
 * - Forward-looking tone; never uses failed/wrong/bad/missed/broke
 * - Performance-adaptive framing (strong / developing / needs review)
 *
 * Falls back to a static motivational message if the LLM call fails or
 * returns empty content. Never throws.
 */
export async function buildSessionInsight(params: SessionInsightParams): Promise<string> {
  const {
    correctAnswers,
    totalQuestions,
    conceptName,
    hintsUsed,
    masteryDelta,
    studentId,
    sessionId,
  } = params;

  if (!totalQuestions) return FALLBACK_INSIGHT;

  const name = conceptName ?? 'this concept';
  const pct = Math.round((correctAnswers / totalQuestions) * 100);
  const masterySign = masteryDelta >= 0 ? '+' : '';

  const prompt = [
    'Generate a single closing insight sentence for an Indian school student who just finished a tutoring session.',
    '',
    'Rules:',
    '- Exactly ONE sentence. Maximum 25 words. No filler phrases.',
    '- Specific to the data below -- not a generic "well done".',
    '- Encouraging, forward-looking tone. NEVER use: failed, wrong, bad, missed, broke.',
    '- If score >= 75%: celebrate the result and point to the next step.',
    '- If score 50-74%: acknowledge progress and name one area to keep working on.',
    '- If score < 50%: acknowledge the effort warmly and suggest reviewing this concept once more.',
    '- Treat hint usage as a normal part of learning, not a weakness.',
    '',
    `Concept: ${name}`,
    `Score: ${correctAnswers}/${totalQuestions} (${pct}%)`,
    `Hints used: ${hintsUsed}/3`,
    `Mastery change: ${masterySign}${Math.round(masteryDelta * 100)}%`,
    '',
    'Output ONLY the single sentence. No tags, no quotation marks, no preamble.',
  ].join('\n');

  try {
    const result = await callTutorLLM(
      prompt,
      { callType: 'tutor:eval', studentId, sessionId },
      INSIGHT_TIMEOUT_MS
    );
    const text = stripTag(result?.content ?? '').trim();
    return text || FALLBACK_INSIGHT;
  } catch {
    return FALLBACK_INSIGHT;
  }
}
