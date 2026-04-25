/**
 * FILE OBJECTIVE:
 * - Central exports for prompt templates and renderer.
 *
 * LINKED UNIT TEST:
 * - tests/unit/prompts/index.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-18T00:00:00Z | copilot-agent | created
 */

export { topicNotesPrompt, type TopicNotesParams } from './topic-notes';
export { topicQuestionsPrompt, type TopicQuestionsParams } from './topic-questions';
export { bilingualNotesPrompt, type BilingualNotesParams } from './bilingual-notes';
export { assemblePrompt, type AssembleParams } from './assemble';
export { syllabusPrompt, type SyllabusParams } from './syllabus';
export { chaptersPrompt, type ChaptersParams } from './chapters';
export { renderTemplate, type TemplateName } from './renderer';
