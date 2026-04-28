/**
 * FILE OBJECTIVE:
 * - Lightweight renderer to produce final prompt strings and a small schema fingerprint.
 *
 * LINKED UNIT TEST:
 * - tests/unit/prompts/renderer.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-18T00:00:00Z | copilot-agent | created
 */

import { topicNotesPrompt, TopicNotesParams } from './topic-notes';
import { topicQuestionsPrompt, TopicQuestionsParams } from './topic-questions';
import { bilingualNotesPrompt, BilingualNotesParams } from './bilingual-notes';
import { assemblePrompt, AssembleParams } from './assemble';
import { syllabusPrompt, SyllabusParams } from './syllabus';
import { chaptersPrompt, ChaptersParams } from './chapters';

export type TemplateName =
  | 'topic-notes'
  | 'topic-questions'
  | 'bilingual-notes'
  | 'assemble'
  | 'syllabus'
  | 'chapters';

function fnv1aHash(input: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16);
}

export function renderTemplate(
  name: 'topic-notes',
  params: TopicNotesParams
): { prompt: string; schemaHash: string; version: string };
export function renderTemplate(
  name: 'topic-questions',
  params: TopicQuestionsParams
): { prompt: string; schemaHash: string; version: string };
export function renderTemplate(
  name: 'bilingual-notes',
  params: BilingualNotesParams
): { prompt: string; schemaHash: string; version: string };
export function renderTemplate(
  name: 'assemble',
  params: AssembleParams
): { prompt: string; schemaHash: string; version: string };
export function renderTemplate(
  name: 'syllabus',
  params: SyllabusParams
): { prompt: string; schemaHash: string; version: string };
export function renderTemplate(
  name: 'chapters',
  params: ChaptersParams
): { prompt: string; schemaHash: string; version: string };
export function renderTemplate(name: TemplateName, params: any) {
  let prompt = '';
  if (name === 'topic-notes') prompt = topicNotesPrompt(params as TopicNotesParams);
  if (name === 'topic-questions') prompt = topicQuestionsPrompt(params as TopicQuestionsParams);
  if (name === 'bilingual-notes') prompt = bilingualNotesPrompt(params as BilingualNotesParams);
  if (name === 'assemble') prompt = assemblePrompt(params as AssembleParams);
  if (name === 'syllabus') prompt = syllabusPrompt(params as SyllabusParams);
  if (name === 'chapters') prompt = chaptersPrompt(params as ChaptersParams);

  // Small deterministic fingerprint to help validation/versioning
  const schemaHash = fnv1aHash(prompt.slice(0, 4096));
  const version = 'prompt_v1';
  return { prompt, schemaHash, version };
}
