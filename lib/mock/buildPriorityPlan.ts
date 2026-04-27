import { callTutorLLM } from '@/lib/callLLM';

const PLAN_TIMEOUT_MS = 10_000;

const FALLBACK_PLAN = `## Next 2 Weeks: Your Study Priority Plan

**Week 1: Strengthen foundations**
- Revisit the sections where you scored below 60% -- aim for 1 revision session per chapter.
- Use the AI tutor for any concepts you found tricky during the exam.

**Week 2: Practice and consolidate**
- Attempt another mock exam after your week-1 revision.
- Focus on time management: practise answering Section C questions within the allotted time.

You are making steady progress -- stay consistent and your scores will improve!`;

export interface SectionScore {
  title: string;
  scorePercent: number;
  marksEarned: number;
  totalMarks: number;
}

/**
 * Generate a personalised "Next 2 Weeks Priority Plan" based on mock exam results.
 *
 * Rules:
 * - Identifies the 1-2 weakest sections (by scorePercent).
 * - Gives concrete, actionable revision steps for the next 14 days.
 * - Encouraging, forward-looking tone (no "failed" / "wrong" / "bad").
 * - Output is Markdown (max 200 words).
 * - Falls back to a static plan on any error. Never throws.
 */
export async function buildPriorityPlan(params: {
  studentId: string;
  attemptId: string;
  subjectName: string;
  overallScore: number;
  sectionScores: SectionScore[];
}): Promise<string> {
  const { studentId, attemptId, subjectName, overallScore, sectionScores } = params;

  const sectionLines = sectionScores
    .map((s) => `- ${s.title}: ${s.marksEarned}/${s.totalMarks} (${Math.round(s.scorePercent)}%)`)
    .join('\n');

  const weak = sectionScores
    .filter((s) => s.scorePercent < 60)
    .sort((a, b) => a.scorePercent - b.scorePercent)
    .slice(0, 2)
    .map((s) => s.title)
    .join(', ');

  const prompt = [
    `An Indian school student just completed a full ${subjectName} mock exam.`,
    '',
    `Overall score: ${Math.round(overallScore)}%`,
    'Section results:',
    sectionLines,
    '',
    `Weakest sections: ${weak || 'all sections performed well'}`,
    '',
    'Write a personalised "Next 2 Weeks Priority Plan" in Markdown.',
    'Rules:',
    '- Max 200 words. Two clear weekly sections.',
    '- Name specific topics/sections to revise.',
    '- Give 2-3 concrete study actions per week.',
    '- Tone: warm, specific, motivating. Never say "failed", "wrong", "bad", "missed".',
    '- End with one encouraging sentence.',
  ].join('\n');

  try {
    const result = await callTutorLLM(
      prompt,
      { callType: 'tutor:eval', studentId, sessionId: attemptId },
      PLAN_TIMEOUT_MS,
    );
    const text = (result?.content ?? '').trim();
    return text || FALLBACK_PLAN;
  } catch {
    return FALLBACK_PLAN;
  }
}
