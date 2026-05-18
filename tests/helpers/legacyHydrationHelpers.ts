/**
 * Test-only in-process hydration helpers.
 * Used by flow/integration tests that need synchronous DB writes
 * instead of enqueueing jobs through BullMQ.
 *
 * In production, use enqueueNotesHydration / enqueueQuestionsHydration from
 * lib/execution-pipeline/enqueueTopicHydration.
 */

import { LanguageCode, DifficultyLevel } from '@prisma/client';
import { callLLM } from '@/lib/callLLM';
import { prisma } from '@/lib/prisma';

export async function runLegacyNotesHydrate(topicId: string, language: string) {
  const llmRes: any = await callLLM({ prompt: 'test', meta: {} });
  const parsed = llmRes?.content ? JSON.parse(llmRes.content) : null;
  if (parsed) {
    const lang = language === 'hi' ? LanguageCode.hi : LanguageCode.en;
    await prisma.topicNote.create({
      data: { topicId, language: lang, title: parsed.title, contentJson: parsed.content, source: 'legacy' },
    });
    try {
      const g: any = global as any;
      g.__TEST_TOPIC_TITLES__ = g.__TEST_TOPIC_TITLES__ || {};
      g.__TEST_TOPIC_TITLES__[topicId] = parsed.title;
    } catch {}
  }
}

export async function runLegacyQuestionsHydrate(topicId: string, difficulty: string, language: string) {
  const g: any = global as any;
  const recorded = g.__TEST_TOPIC_TITLES__ ? g.__TEST_TOPIC_TITLES__[topicId] : undefined;
  const topic = await prisma.topicDef.findUnique({ where: { id: topicId } });
  const llmRes: any = await callLLM({ prompt: 'test', meta: {} });
  const parsed = llmRes?.content ? JSON.parse(llmRes.content) : null;
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
