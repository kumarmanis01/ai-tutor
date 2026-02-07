/**
 * FILE OBJECTIVE:
 * - OpenAI tool definition + handler for generating daily learning tasks via AI.
 * - Called by the Daily Habit Engine when mastery-based selection alone isn't sufficient.
 * - Enforces: one task, max 3 steps, grade-appropriate, language-matched.
 * - Inactivity >= 7 days forces recovery task type.
 * - Difficulty never increases after inactivity.
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created AI-powered daily task generator
 */

import { callLLM } from '@/lib/callLLM';
import { logger } from '@/lib/logger';
import { resolveTokenBudget } from '../tokenGovernor';

// ── Tool Schema (OpenAI function calling format) ───────────────────

export const GENERATE_DAILY_TASK_SCHEMA = {
  type: 'function' as const,
  function: {
    name: 'generate_daily_task',
    description: 'Generate a single daily learning task for a K-12 student. Output must be grade-appropriate and language-matched.',
    parameters: {
      type: 'object',
      properties: {
        student_profile: {
          type: 'object',
          properties: {
            grade: { type: 'integer', description: 'Student grade (1-12)' },
            language: { type: 'string', description: 'Preferred language: en, hi, hinglish' },
            strengths: { type: 'array', items: { type: 'string' }, description: 'Topics/subjects student is strong in' },
            weaknesses: { type: 'array', items: { type: 'string' }, description: 'Topics/subjects student struggles with' },
            last_active_days_ago: { type: 'integer', description: 'Days since last activity' },
          },
          required: ['grade', 'language', 'last_active_days_ago'],
          additionalProperties: false,
        },
        learning_context: {
          type: 'object',
          properties: {
            current_topic: { type: 'string', description: 'Current topic being studied' },
            difficulty_level: { type: 'integer', description: 'Current difficulty (1-5)' },
          },
          additionalProperties: false,
        },
      },
      required: ['student_profile', 'learning_context'],
      additionalProperties: false,
    },
    strict: true,
  },
} as const;

// ── Output Contract ────────────────────────────────────────────────

export interface DailyTaskAIOutput {
  task_type: 'learn' | 'practice' | 'revise' | 'recover';
  title: string;
  description: string;
  estimated_time_min: number;
  steps: { step_type: 'read' | 'answer'; content: string }[];
  motivation_message: string;
}

// ── Input types ────────────────────────────────────────────────────

export interface StudentProfile {
  grade: number;
  language: string;
  strengths?: string[];
  weaknesses?: string[];
  last_active_days_ago: number;
}

export interface LearningContext {
  current_topic?: string;
  difficulty_level?: number;
}

// ── Handler ────────────────────────────────────────────────────────

export async function generateDailyTaskAI(
  profile: StudentProfile,
  context: LearningContext,
): Promise<DailyTaskAIOutput> {
  // Enforce recovery if inactive >= 7 days
  const forceRecovery = profile.last_active_days_ago >= 7;

  // Cap difficulty after inactivity (never increase)
  const effectiveDifficulty = forceRecovery
    ? 1
    : Math.min(context.difficulty_level ?? 3, profile.last_active_days_ago >= 3 ? 2 : 5);

  // Resolve token budget and model for this grade
  const budget = resolveTokenBudget(profile.grade, 'daily_task');

  const prompt = buildPrompt(profile, context, forceRecovery, effectiveDifficulty);

  try {
    const result = await callLLM({
      prompt,
      model: budget.model,
      meta: {
        promptType: 'daily_task',
        grade: String(profile.grade),
        language: profile.language,
        topic: context.current_topic,
      },
      timeoutMs: 10_000,
    });

    const parsed = parseOutput(result.content);
    return validateOutput(parsed, forceRecovery);
  } catch (error) {
    logger.error('generateDailyTaskAI.failed', {
      grade: profile.grade,
      error: error instanceof Error ? error.message : String(error),
    });
    // Deterministic fallback — no AI needed
    return buildFallbackTask(profile, context, forceRecovery);
  }
}

// ── Prompt builder ─────────────────────────────────────────────────

function buildPrompt(
  profile: StudentProfile,
  context: LearningContext,
  forceRecovery: boolean,
  effectiveDifficulty: number,
): string {
  const gradeLabel = profile.grade <= 3 ? 'young learner' : profile.grade <= 7 ? 'middle schooler' : 'high schooler';
  const langInstruction = profile.language === 'hi'
    ? 'Respond in simple Hindi.'
    : profile.language === 'hinglish'
      ? 'Respond in Hinglish (Hindi+English mix).'
      : 'Respond in simple English.';

  const taskTypeInstruction = forceRecovery
    ? 'Task type MUST be "recover". This student has been inactive — make it very easy and encouraging.'
    : 'Choose the best task type: learn (new topic), practice (questions), revise (spaced repetition), or recover (re-engagement).';

  const strengthsLine = profile.strengths?.length
    ? `Strengths: ${profile.strengths.join(', ')}`
    : '';
  const weaknessesLine = profile.weaknesses?.length
    ? `Areas to work on: ${profile.weaknesses.join(', ')}`
    : '';

  return `You are generating a single daily learning task for a Grade ${profile.grade} ${gradeLabel}.
${langInstruction}

Student context:
- Grade: ${profile.grade}
- Current topic: ${context.current_topic || 'general revision'}
- Difficulty ceiling: ${effectiveDifficulty}/5
- Days since last activity: ${profile.last_active_days_ago}
${strengthsLine ? `- ${strengthsLine}` : ''}
${weaknessesLine ? `- ${weaknessesLine}` : ''}

Rules:
1. ${taskTypeInstruction}
2. Generate EXACTLY ONE task
3. Maximum 3 steps
4. Estimated time: 10-25 minutes
5. Tone: encouraging, zero pressure, child-safe
6. Never mention scores, ranks, or comparisons
7. Each step must be either "read" (read/watch something) or "answer" (solve/practice)

Respond ONLY with valid JSON matching this structure:
{
  "task_type": "learn | practice | revise | recover",
  "title": "short student-facing title",
  "description": "1-2 sentence encouraging description",
  "estimated_time_min": 15,
  "steps": [
    { "step_type": "read | answer", "content": "what to do" }
  ],
  "motivation_message": "encouraging message shown on completion"
}`;
}

// ── Output parsing + validation ────────────────────────────────────

function parseOutput(content: string): DailyTaskAIOutput {
  // Strip markdown fences if present
  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return JSON.parse(cleaned);
}

function validateOutput(output: DailyTaskAIOutput, forceRecovery: boolean): DailyTaskAIOutput {
  // Enforce task type on recovery
  if (forceRecovery && output.task_type !== 'recover') {
    output.task_type = 'recover';
  }

  // Validate task type
  const validTypes = ['learn', 'practice', 'revise', 'recover'];
  if (!validTypes.includes(output.task_type)) {
    output.task_type = 'learn';
  }

  // Cap steps at 3
  if (output.steps.length > 3) {
    output.steps = output.steps.slice(0, 3);
  }

  // Validate step types
  for (const step of output.steps) {
    if (step.step_type !== 'read' && step.step_type !== 'answer') {
      step.step_type = 'read';
    }
  }

  // Clamp estimated time
  if (output.estimated_time_min < 10) output.estimated_time_min = 10;
  if (output.estimated_time_min > 25) output.estimated_time_min = 25;

  // Ensure motivation message exists
  if (!output.motivation_message) {
    output.motivation_message = 'Great work today! Every step counts.';
  }

  return output;
}

// ── Fallback (no AI needed) ────────────────────────────────────────

function buildFallbackTask(
  profile: StudentProfile,
  context: LearningContext,
  forceRecovery: boolean,
): DailyTaskAIOutput {
  const topic = context.current_topic || 'your current topic';

  if (forceRecovery) {
    return {
      task_type: 'recover',
      title: `Welcome Back: Quick Review`,
      description: 'A gentle warm-up to ease you back in. No pressure!',
      estimated_time_min: 10,
      steps: [
        { step_type: 'read', content: `Read through the summary of ${topic}` },
        { step_type: 'answer', content: 'Try 2 easy questions' },
      ],
      motivation_message: 'You showed up — that\'s what matters!',
    };
  }

  return {
    task_type: 'learn',
    title: `Today: ${topic}`,
    description: 'Your daily dose of learning. Let\'s go!',
    estimated_time_min: 15,
    steps: [
      { step_type: 'read', content: `Read the notes on ${topic}` },
      { step_type: 'answer', content: 'Try 3 practice questions' },
      { step_type: 'read', content: 'Review what you learned' },
    ],
    motivation_message: 'Another day, another step forward!',
  };
}
