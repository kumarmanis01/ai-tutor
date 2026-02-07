/**
 * FILE OBJECTIVE:
 * - OpenAI tool for generating parent-friendly weekly summaries via AI.
 * - Output: under 120 words, no grades/marks/ranks.
 * - Must include: 1 improvement, 1 encouragement, 1 suggested parent action.
 * - Tone: calm, respectful, reassuring. Language: simple, school-agnostic.
 * - Supports Hindi + English + Hinglish.
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created AI parent report generator
 */

import { callLLM } from '@/lib/callLLM';
import { logger } from '@/lib/logger';
import { resolveTokenBudget } from '../tokenGovernor';

// ── Tool Schema ────────────────────────────────────────────────────

export const GENERATE_PARENT_REPORT_SCHEMA = {
  type: 'function' as const,
  function: {
    name: 'generate_parent_weekly_report',
    description: 'Summarize a student\'s weekly learning in parent-friendly language. Under 120 words. No grades or ranks.',
    parameters: {
      type: 'object',
      properties: {
        student_id: { type: 'string' },
        student_name: { type: 'string' },
        week_summary: {
          type: 'object',
          properties: {
            days_active: { type: 'integer', description: 'Days the student was active this week (0-7)' },
            time_spent_min: { type: 'integer', description: 'Total minutes spent learning' },
            improved_topics: { type: 'array', items: { type: 'string' }, description: 'Topics where performance improved' },
            struggling_topics: { type: 'array', items: { type: 'string' }, description: 'Topics needing more practice' },
            streak_days: { type: 'integer', description: 'Current daily streak' },
            tests_taken: { type: 'integer', description: 'Number of tests completed' },
          },
          required: ['days_active', 'time_spent_min'],
          additionalProperties: false,
        },
        language: { type: 'string', description: 'Output language: en, hi, hinglish' },
      },
      required: ['student_id', 'week_summary'],
      additionalProperties: false,
    },
    strict: true,
  },
} as const;

// ── Output Contract ────────────────────────────────────────────────

export interface ParentReportOutput {
  summary: string;        // The full message (under 120 words)
  improvement: string;    // Single improvement highlight
  encouragement: string;  // Single encouraging statement
  parent_action: string;  // Suggested parent action
}

// ── Input types ────────────────────────────────────────────────────

export interface WeekSummaryInput {
  days_active: number;
  time_spent_min: number;
  improved_topics?: string[];
  struggling_topics?: string[];
  streak_days?: number;
  tests_taken?: number;
}

// ── Handler ────────────────────────────────────────────────────────

export async function generateParentReportAI(
  studentName: string,
  summary: WeekSummaryInput,
  language: string = 'en',
): Promise<ParentReportOutput> {
  const budget = resolveTokenBudget(5, 'parent_report'); // Always use cheap model

  const prompt = buildPrompt(studentName, summary, language);

  try {
    const result = await callLLM({
      prompt,
      model: budget.model,
      meta: {
        promptType: 'parent_report',
        language,
        suppressLog: false,
      },
      timeoutMs: 8_000,
    });

    const parsed = parseOutput(result.content);
    return validateOutput(parsed);
  } catch (error) {
    logger.error('generateParentReportAI.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return buildFallbackReport(studentName, summary, language);
  }
}

// ── Prompt builder ─────────────────────────────────────────────────

function buildPrompt(
  studentName: string,
  summary: WeekSummaryInput,
  language: string,
): string {
  const langInstruction = language === 'hi'
    ? 'Respond entirely in simple Hindi. Use Devanagari script.'
    : language === 'hinglish'
      ? 'Respond in Hinglish (Hindi+English mix, Roman script).'
      : 'Respond in simple English.';

  const improved = summary.improved_topics?.length
    ? `Improved topics: ${summary.improved_topics.join(', ')}`
    : 'No specific improvement data this week';

  const struggling = summary.struggling_topics?.length
    ? `Topics needing practice: ${summary.struggling_topics.join(', ')}`
    : '';

  return `You are writing a weekly learning summary for a parent. The parent's child is named ${studentName}.

${langInstruction}

This week's data:
- Days active: ${summary.days_active}/7
- Total study time: ${summary.time_spent_min} minutes
- ${improved}
${struggling ? `- ${struggling}` : ''}
${summary.streak_days ? `- Learning streak: ${summary.streak_days} days` : ''}
${summary.tests_taken ? `- Tests completed: ${summary.tests_taken}` : ''}

Rules:
1. UNDER 120 WORDS total
2. NEVER mention scores, marks, ranks, percentages, or comparisons with other students
3. Must include exactly:
   - 1 improvement highlight (what got better)
   - 1 encouragement (positive reinforcement)
   - 1 suggested parent action (simple, doable)
4. Tone: calm, respectful, reassuring. Like a caring tutor talking to a parent.
5. Use "${studentName}" (not "your child" or "the student")
6. If struggling topics exist, frame them as "areas to grow" not "weaknesses"
7. End with a warm sign-off

Respond ONLY with valid JSON:
{
  "summary": "the full parent-facing message",
  "improvement": "single improvement sentence",
  "encouragement": "single encouraging sentence",
  "parent_action": "single suggested parent action"
}`;
}

// ── Output parsing + validation ────────────────────────────────────

function parseOutput(content: string): ParentReportOutput {
  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return JSON.parse(cleaned);
}

function validateOutput(output: ParentReportOutput): ParentReportOutput {
  // Word count check — truncate if over 120 words
  const words = output.summary.split(/\s+/);
  if (words.length > 130) { // Small buffer
    output.summary = words.slice(0, 120).join(' ') + '...';
  }

  // Ensure all required fields exist
  if (!output.improvement) output.improvement = 'Consistent effort this week.';
  if (!output.encouragement) output.encouragement = 'Keep encouraging regular study!';
  if (!output.parent_action) output.parent_action = 'Ask about what they learned today.';

  return output;
}

// ── Fallback (deterministic, no AI) ────────────────────────────────

function buildFallbackReport(
  studentName: string,
  summary: WeekSummaryInput,
  language: string,
): ParentReportOutput {
  if (language === 'hi') {
    const improved = summary.improved_topics?.[0] || 'अध्ययन';
    return {
      summary: `इस हफ्ते ${studentName} ने ${summary.days_active} दिन पढ़ाई की। ${improved} में अच्छी प्रगति हुई। ${studentName} को प्रोत्साहित करते रहें — हर छोटा कदम मायने रखता है।`,
      improvement: `${improved} में प्रगति`,
      encouragement: `${studentName} सही दिशा में बढ़ रहे हैं।`,
      parent_action: 'आज क्या सीखा, यह पूछें — बच्चों को बहुत अच्छा लगता है।',
    };
  }

  if (language === 'hinglish') {
    const improved = summary.improved_topics?.[0] || 'studies';
    return {
      summary: `Is week ${studentName} ne ${summary.days_active} din padhai ki. ${improved} mein acchi progress hui. ${studentName} ko encourage karte rahiye — har chhota step matter karta hai.`,
      improvement: `${improved} mein progress`,
      encouragement: `${studentName} sahi direction mein hai.`,
      parent_action: 'Aaj kya seekha, ye poochiye — bacchon ko bahut accha lagta hai.',
    };
  }

  // English fallback
  const improved = summary.improved_topics?.[0] || 'their studies';
  const timeStr = summary.time_spent_min >= 60
    ? `${Math.round(summary.time_spent_min / 60)} hours`
    : `${summary.time_spent_min} minutes`;

  return {
    summary: `This week, ${studentName} studied on ${summary.days_active} days for a total of ${timeStr}. ${studentName} showed progress in ${improved}. Keep encouraging regular practice — every small step adds up.`,
    improvement: `Progress in ${improved}.`,
    encouragement: `${studentName} is moving in the right direction.`,
    parent_action: 'Ask what they learned today — children love sharing when asked.',
  };
}
