/**
 * FILE OBJECTIVE:
 * - Define canonical prompt registry types used by prompt infrastructure APIs.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompt-registry/types.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T15:00:00Z | copilot | created shared PromptType and PromptConfig contracts for Sprint 7
 */

export enum PromptType {
  LESSON_GENERATION = 'LESSON_GENERATION',
  CONTENT_ENHANCEMENT = 'CONTENT_ENHANCEMENT',
  DOUBT_SOLVING = 'DOUBT_SOLVING',
  SIMPLE_EXPLANATION = 'SIMPLE_EXPLANATION',
  PRACTICE_QUESTIONS = 'PRACTICE_QUESTIONS',
  DIAGNOSTIC_QUIZ = 'DIAGNOSTIC_QUIZ',
  PROGRESSIVE_HINTS = 'PROGRESSIVE_HINTS',
  CONTENT_TAGGING = 'CONTENT_TAGGING',
  WEEKLY_REPORT = 'WEEKLY_REPORT',
}

export enum PromptStatus {
  DRAFT = 'DRAFT',
  TESTING = 'TESTING',
  ACTIVE = 'ACTIVE',
  DEPRECATED = 'DEPRECATED',
  ARCHIVED = 'ARCHIVED',
}

export type PromptVariables = Record<string, unknown>;

export interface PromptConfig {
  id: string;
  type: PromptType;
  version: string;
  systemPrompt: string;
  userPromptBuilder: (variables: PromptVariables) => string;
  model: string;
  maxTokens: number;
  temperature: number;
  createdAt: string;
  lastModifiedAt: string;
  status: PromptStatus;
}

export interface PromptListFilter {
  status?: PromptStatus;
  type?: PromptType;
}

export interface PromptListDbFilter extends PromptListFilter {
  page?: number;
  pageSize?: number;
}

export interface PromptVersionRecord {
  id: string;
  promptType: PromptType;
  version: string;
  systemPrompt: string;
  userPromptTemplate: string;
  modelName: string;
  maxTokens: number;
  temperature: number;
  status: PromptStatus;
  changeNotes: string | null;
  createdBy: string | null;
  performanceScore: number | null;
  usageCount: number;
  avgLatencyMs: number | null;
  avgTokenUsage: number | null;
  createdAt: Date;
  updatedAt: Date;
}
