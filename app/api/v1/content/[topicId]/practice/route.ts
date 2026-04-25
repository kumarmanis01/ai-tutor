/**
 * FILE OBJECTIVE:
 * - GET /api/v1/content/[topicId]/practice
 * - Returns practice questions for a topic for S2.3 practice flow.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/content/topicId/practice/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.3 topic practice fetch endpoint
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ topicId: string }>;
}

type ChoiceOption = { key: string; label: string };

function normalizeChoices(raw: unknown): ChoiceOption[] {
  if (!Array.isArray(raw)) return [];

  if (raw.every((item) => typeof item === 'string')) {
    return (raw as string[]).map((label, index) => ({
      key: String.fromCharCode(65 + index),
      label,
    }));
  }

  return (raw as Array<{ key?: unknown; label?: unknown }>)
    .map((item, index) => ({
      key:
        typeof item.key === 'string' && item.key.trim().length > 0
          ? item.key.trim().toUpperCase()
          : String.fromCharCode(65 + index),
      label: typeof item.label === 'string' ? item.label.trim() : '',
    }))
    .filter((item) => item.label.length > 0);
}

export async function GET(req: Request, { params }: Params) {
  const start = Date.now();
  const { topicId } = await params;
  const url = new URL(req.url);
  const countRaw = Number.parseInt(url.searchParams.get('count') ?? '5', 10);
  const count = Number.isNaN(countRaw) ? 5 : Math.min(10, Math.max(1, countRaw));

  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'TopicPracticeFetchAPI', methodName: 'GET' }, start);
      return res;
    }

    const topic = await prisma.topicDef.findUnique({
      where: { id: topicId },
      select: { id: true, name: true },
    });

    if (!topic) {
      const res = NextResponse.json({ error: 'Topic not found' }, { status: 404 });
      logger.logAPI(req, res, { className: 'TopicPracticeFetchAPI', methodName: 'GET' }, start);
      return res;
    }

    const questions = await prisma.question.findMany({
      where: {
        topicId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
      take: count,
      select: {
        id: true,
        prompt: true,
        choices: true,
        difficulty: true,
        correctAnswer: true,
      },
    });

    const payload = questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: normalizeChoices(question.choices),
      difficulty: question.difficulty,
      // Keep hint deterministic and safe when explanation is unavailable in the model.
      hint: 'Revisit the key idea from this lesson and eliminate two unlikely options first.',
      // The client uses this only for local instant feedback; final grading still happens in submit endpoint.
      answerKey: question.correctAnswer,
    }));

    const res = NextResponse.json({ topicId, topicName: topic.name, questions: payload });
    logger.logAPI(req, res, { className: 'TopicPracticeFetchAPI', methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('TopicPracticeFetchAPI.error', {
      event: 'topic_practice_fetch_failed',
      context: { error: err instanceof Error ? err.message : String(err), topicId },
    });
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'TopicPracticeFetchAPI', methodName: 'GET' }, start);
    return res;
  }
}
