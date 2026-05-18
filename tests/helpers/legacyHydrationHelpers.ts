/**
 * FILE OBJECTIVE:
 * - Test-only in-process hydration helpers.
 *   Used by flow/integration tests that need synchronous DB writes
 *   instead of enqueueing jobs through BullMQ.
 *
 * LINKED UNIT TEST:
 * - tests/flow/hydrationFlow.test.ts
 * - tests/integration/hydrationFlow.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-18 | claude | extracted from hydrators/testLegacyHydrateHelpers.ts (deleted)
 * - 2026-05-18 | claude | fix: replace any casts with narrow types; remove empty catch block
 *
 * In production, use enqueueNotesHydration / enqueueQuestionsHydration from
 * lib/execution-pipeline/enqueueTopicHydration.
 */

import { LanguageCode, DifficultyLevel } from '@prisma/client';
import { callLLM } from '@/lib/callLLM';
import { prisma } from '@/lib/prisma';

interface LLMResult { content: string }
interface ParsedNote { title: string; content: unknown }
interface ParsedQuestion { type: string; question: string; options: unknown; answer: unknown }
interface ParsedQuestions { title?: string; questions: ParsedQuestion[] }

// Shared global for passing the topic title from notes -> questions hydration within a test run.
interface TestTopicTitles { [topicId: string]: string }
const g = global as typeof global & { __TEST_TOPIC_TITLES__?: TestTopicTitles };

export async function runLegacyNotesHydrate(topicId: string, language: string): Promise<void> {
  const llmRes = await callLLM({ prompt: 'test', meta: {} }) as LLMResult | null;
  const parsed: ParsedNote | null = llmRes?.content ? JSON.parse(llmRes.content) : null;
  if (parsed) {
    const lang = language === 'hi' ? LanguageCode.hi : LanguageCode.en;
    await prisma.topicNote.create({
      data: { topicId, language: lang, title: parsed.title, contentJson: parsed.content, source: 'legacy' },
    });
    g.__TEST_TOPIC_TITLES__ = g.__TEST_TOPIC_TITLES__ ?? {};
    g.__TEST_TOPIC_TITLES__[topicId] = parsed.title;
  }
}

export async function runLegacyQuestionsHydrate(topicId: string, difficulty: string, language: string): Promise<void> {
  const recorded = g.__TEST_TOPIC_TITLES__?.[topicId];
  const topic = await prisma.topicDef.findUnique({ where: { id: topicId } });
  const llmRes = await callLLM({ prompt: 'test', meta: {} }) as LLMResult | null;
  const parsed: ParsedQuestions | null = llmRes?.content ? JSON.parse(llmRes.content) : null;
  const title = parsed?.title ?? recorded ?? (topic ? `${topic.name} - Generated Test` : undefined);
  if (parsed) {
    const lang = language === 'hi' ? LanguageCode.hi : LanguageCode.en;
    const diff = difficulty === 'easy' ? DifficultyLevel.easy : difficulty === 'medium' ? DifficultyLevel.medium : DifficultyLevel.hard;
    const test = await prisma.generatedTest.create({
      data: { topicId, language: lang, difficulty: diff, title, questions: parsed.questions || [] },
    });
    if (Array.isArray(parsed.questions)) {
      for (const q of parsed.questions) {
        await prisma.generatedQuestion.create({
          data: { testId: test.id, question: q.question, options: q.options, answer: q.answer, type: q.type },
        });
      }
    }
  }
}
