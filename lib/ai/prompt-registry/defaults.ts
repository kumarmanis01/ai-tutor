/**
 * FILE OBJECTIVE:
 * - Provide hardcoded fallback prompt definitions for all Sprint 7 prompt types.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompt-registry/defaults.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T15:00:00Z | copilot | created default prompt registry fallback entries for all 9 prompt types
 */

import { PromptConfig, PromptStatus, PromptType, PromptVariables } from './types';

const NOW = '2026-04-26T00:00:00Z';

function toStringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

export function buildUserPromptFromTemplate(
  template: string,
  variables: PromptVariables = {}
): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) =>
    toStringValue(variables[key])
  );
}

interface DefaultPromptSeed {
  readonly id: string;
  readonly type: PromptType;
  readonly version: string;
  readonly systemPrompt: string;
  readonly userPromptTemplate: string;
  readonly model: string;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly status: PromptStatus;
}

const DEFAULT_PROMPT_SEEDS: readonly DefaultPromptSeed[] = [
  {
    id: 'seed-lesson-generation-v1-0-0',
    type: PromptType.LESSON_GENERATION,
    version: 'v1.0.0',
    systemPrompt: 'You are Vidya, a curriculum-aligned tutor for K-12 students in India.',
    userPromptTemplate:
      'Generate a complete lesson for {{topic}} in {{language}} for Grade {{grade}} {{board}} students. Include objectives, explanation, examples, recap, and 3 Socratic checks.',
    model: 'gpt-4o-mini',
    maxTokens: 1400,
    temperature: 0.3,
    status: PromptStatus.ACTIVE,
  },
  {
    id: 'seed-content-enhancement-v1-0-0',
    type: PromptType.CONTENT_ENHANCEMENT,
    version: 'v1.0.0',
    systemPrompt: 'You improve educational content while preserving factual correctness.',
    userPromptTemplate:
      'Enhance the provided content for {{topic}} so it is clear for Grade {{grade}} {{board}} students in {{language}}.',
    model: 'gpt-4o-mini',
    maxTokens: 1200,
    temperature: 0.2,
    status: PromptStatus.ACTIVE,
  },
  {
    id: 'seed-doubt-solving-v1-0-0',
    type: PromptType.DOUBT_SOLVING,
    version: 'v1.0.0',
    systemPrompt: 'You solve student doubts with Socratic guidance and no answer dumping.',
    userPromptTemplate:
      'Answer this doubt: {{studentQuestion}} for {{subject}} Grade {{grade}} {{board}} in {{preferredLanguage}} and ask one follow-up.',
    model: 'gpt-4o-mini',
    maxTokens: 900,
    temperature: 0.2,
    status: PromptStatus.ACTIVE,
  },
  {
    id: 'seed-simple-explanation-v1-0-0',
    type: PromptType.SIMPLE_EXPLANATION,
    version: 'v1.0.0',
    systemPrompt: 'You simplify difficult school concepts with clear analogies.',
    userPromptTemplate:
      'Explain {{concept}} in simple terms for Grade {{grade}} {{board}} students in {{language}}.',
    model: 'gpt-4o-mini',
    maxTokens: 700,
    temperature: 0.2,
    status: PromptStatus.ACTIVE,
  },
  {
    id: 'seed-practice-questions-v1-0-0',
    type: PromptType.PRACTICE_QUESTIONS,
    version: 'v1.0.0',
    systemPrompt: 'You generate high-quality practice questions with clear explanations.',
    userPromptTemplate:
      'Create {{count}} practice questions on {{topic}} for {{subject}} Grade {{grade}} {{board}} in {{language}}.',
    model: 'gpt-4o-mini',
    maxTokens: 1100,
    temperature: 0.2,
    status: PromptStatus.ACTIVE,
  },
  {
    id: 'seed-diagnostic-quiz-v1-0-0',
    type: PromptType.DIAGNOSTIC_QUIZ,
    version: 'v1.0.0',
    systemPrompt: 'You generate diagnostic quizzes that accurately assess student level.',
    userPromptTemplate:
      'Create a diagnostic quiz for {{subject}} Grade {{grade}} {{board}} in {{language}} with mixed difficulty.',
    model: 'gpt-4o-mini',
    maxTokens: 1100,
    temperature: 0.2,
    status: PromptStatus.ACTIVE,
  },
  {
    id: 'seed-progressive-hints-v1-0-0',
    type: PromptType.PROGRESSIVE_HINTS,
    version: 'v1.0.0',
    systemPrompt: 'You provide hints in progressive levels from broad to specific.',
    userPromptTemplate:
      'Generate three progressive hints for {{question}} for Grade {{grade}} {{board}} without revealing the final answer early.',
    model: 'gpt-4o-mini',
    maxTokens: 500,
    temperature: 0.2,
    status: PromptStatus.ACTIVE,
  },
  {
    id: 'seed-content-tagging-v1-0-0',
    type: PromptType.CONTENT_TAGGING,
    version: 'v1.0.0',
    systemPrompt: 'You tag educational content for indexing and retrieval.',
    userPromptTemplate:
      'Tag this content for {{subject}} Grade {{grade}} {{board}} with chapter, topic, skills, and difficulty metadata.',
    model: 'gpt-4o-mini',
    maxTokens: 500,
    temperature: 0.1,
    status: PromptStatus.ACTIVE,
  },
  {
    id: 'seed-weekly-report-v1-0-0',
    type: PromptType.WEEKLY_REPORT,
    version: 'v1.0.0',
    systemPrompt: 'You generate concise and parent-friendly weekly student progress reports.',
    userPromptTemplate:
      'Write a weekly report in {{language}} for this student summary: {{summaryData}}.',
    model: 'gpt-4o-mini',
    maxTokens: 900,
    temperature: 0.2,
    status: PromptStatus.ACTIVE,
  },
];

export const DEFAULT_PROMPTS: ReadonlyArray<PromptConfig> = DEFAULT_PROMPT_SEEDS.map((seed) => ({
  id: seed.id,
  type: seed.type,
  version: seed.version,
  systemPrompt: seed.systemPrompt,
  userPromptBuilder: (variables: PromptVariables) =>
    buildUserPromptFromTemplate(seed.userPromptTemplate, variables),
  model: seed.model,
  maxTokens: seed.maxTokens,
  temperature: seed.temperature,
  createdAt: NOW,
  lastModifiedAt: NOW,
  status: seed.status,
}));

export const DEFAULT_PROMPT_TEMPLATES = DEFAULT_PROMPT_SEEDS.reduce<
  Record<string, string>
>((acc, item) => {
  acc[`${item.type}:${item.version}`] = item.userPromptTemplate;
  return acc;
}, {});
