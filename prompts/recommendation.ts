/**
 * FILE OBJECTIVE:
 * - Prompt template for the LLM-based personalized recommendation engine.
 *   Builds a context-rich prompt and exports the system role string.
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | initial: recommendation prompt builder
 */

import type { RecommendationContext } from '@/types/recommendation';

export const RECOMMENDATION_SYSTEM_PROMPT =
  'You are Vidya, an AI tutor for Indian students (CBSE/ICSE Grades 6-12). ' +
  'Your task is to generate personalized study recommendations. ' +
  'You NEVER give direct answers to practice problems. ' +
  'Return ONLY a valid JSON array with no markdown, no preamble, and no trailing text.';

/**
 * Builds the user-turn prompt sent to the LLM.
 * The LLM must return a JSON array matching the Recommendation interface.
 */
export function buildRecommendationPrompt(ctx: RecommendationContext): string {
  const weakTopicsSummary =
    ctx.weakTopics.length > 0
      ? ctx.weakTopics
          .map(
            (t) =>
              `- "${t.topic}": mastery ${Math.round(t.masteryScore * 100)}%, last attempted ${formatDaysAgo(t.lastAttemptedAt)}`
          )
          .join('\n')
      : '(none recorded)';

  const recentTopics =
    ctx.recentChatTopics.length > 0
      ? ctx.recentChatTopics.map((t) => `"${t}"`).join(', ')
      : '(no recent chats)';

  const testScoreLine =
    ctx.lastTestScore !== undefined
      ? `Last test score: ${Math.round(ctx.lastTestScore)}%`
      : 'No test scores recorded yet.';

  const activityLine =
    ctx.daysSinceLastActivity === 0
      ? 'Student was active today.'
      : `Student last active ${ctx.daysSinceLastActivity} day(s) ago.`;

  const gradeLine = ctx.grade ? `Grade: ${ctx.grade}` : '';
  const boardLine = ctx.board ? `Board: ${ctx.board}` : '';

  return `You are generating 4 personalized study recommendations for a student.

STUDENT CONTEXT:
${gradeLine}
${boardLine}
${testScoreLine}
${activityLine}
Total tests attempted: ${ctx.totalTestsAttempted}
Recent chat topics: ${recentTopics}

WEAK TOPICS (mastery < 60%):
${weakTopicsSummary}

RULES:
1. Return EXACTLY 4 recommendations as a JSON array. No other text.
2. Order by relevanceScore descending (highest first).
3. Mix recommendation types — do NOT return 4 of the same type.
   Valid types: "topic_review", "practice_test", "new_concept", "doubt_clearance"
4. Do NOT repeat a topic already in recent chat topics UNLESS its masteryScore < 0.4.
5. If the student has no history, return 3 general onboarding recommendations
   and 1 motivational new_concept recommendation.
6. Each "title" must be 6 words or fewer.
7. Each "prompt" must be 20 words or fewer — this is the pre-filled question the
   student will send to the chat. Make it a specific study question.
8. Each "reason" must be 1 sentence citing evidence (e.g. score, days inactive).
9. The "id" must be a unique slug combining type and topic (e.g. "topic_review-algebra").
10. relevanceScore must be between 0.0 and 1.0.

JSON SCHEMA (array of objects):
[
  {
    "id": "<slug>",
    "type": "<RecommendationType>",
    "title": "<max 6 words>",
    "prompt": "<max 20 words>",
    "reason": "<1 sentence evidence>",
    "relevanceScore": <0.0 - 1.0>,
    "topic": "<topic string or omit if general>"
  }
]

Return ONLY the JSON array. No markdown fences. No explanation.`;
}

function formatDaysAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}
