/**
 * FILE OBJECTIVE:
 * - Handle student doubt submissions with auth, safety checks, and persisted Q&A records.
 * - Keep LLM execution in worker context while supporting low-latency responses by briefly waiting for worker completion.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/doubts/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | move doubts LLM to worker queue and add short synchronous wait for fast responses
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import {
  buildDoubtsPrompt,
  isOffTopicQuestion,
  getOffTopicRedirect,
} from '@/lib/ai/prompts/doubts';
import type { StudentIntent, ConversationMessage } from '@/lib/ai/prompts/schemas';

export const dynamic = 'force-dynamic';

const FALLBACK_RESPONSE = {
  response: `I am having a little trouble connecting right now, so I cannot give you a full explanation at this moment.\n\nPlease try asking again in a few seconds -- I want to give you a proper, detailed answer with examples, not a quick summary. Your question deserves a real explanation!`,
  followUpQuestion: `Could you try asking again? I want to make sure I explain your question properly with examples.`,
  confidenceLevel: 'low' as const,
};

const STATUS_PROCESSING = 'processing';
const STATUS_ANSWERED = 'answered';
const DOUBTS_SYNC_WAIT_MS = Number(process.env.DOUBTS_SYNC_WAIT_MS ?? 5000);
const DOUBTS_POLL_INTERVAL_MS = Number(process.env.DOUBTS_POLL_INTERVAL_MS ?? 250);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST /api/doubts
 * Body: {
 *   question: string,
 *   subject: string,
 *   chapter: string,
 *   topic: string,
 *   intent?: StudentIntent,
 *   conversationHistory?: ConversationMessage[],
 *   questionId?: string  // existing StudentQuestion id for follow-ups
 * }
 *
 * Enqueues a worker job to generate AI response via LLM (worker-only).
 * Returns 202 ACCEPTED with jobId, or 200 with fallback if enqueue fails.
 * Returns async response polling endpoint for frontend.
 */
export async function POST(req: Request) {
  const start = Date.now();
  let res: Response;
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'POST' }, start);
    return res;
  }

  const body = await req.json().catch(() => null);
  if (!body?.question || typeof body.question !== 'string' || body.question.trim().length === 0) {
    res = NextResponse.json({ error: 'Question is required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'POST' }, start);
    return res;
  }

  const {
    question,
    subject,
    chapter,
    topic,
    intent,
    conversationHistory,
    questionId,
  } = body as {
    question: string;
    subject?: string;
    chapter?: string;
    topic?: string;
    intent?: StudentIntent;
    conversationHistory?: ConversationMessage[];
    questionId?: string;
  };

  const studentSubject = subject ?? 'General';
  const studentChapter = chapter ?? '';
  const studentTopic = topic ?? '';

  // Off-topic check
  if (isOffTopicQuestion(question, studentSubject)) {
    const redirect = getOffTopicRedirect(studentSubject);
    // Still record the question
    const sq = await prisma.studentQuestion.create({
      data: {
        studentId: user.id,
        type: 'doubt',
        subject: studentSubject,
        grade: (user as any).grade ?? null,
        content: question,
        status: 'answered',
        answeredAt: new Date(),
        answerSummary: redirect.response,
        aiMetadata: { offTopic: true, intent: intent ?? 'conceptual_clarity' },
      },
    });
    res = NextResponse.json({
      questionId: sq.id,
      response: redirect.response,
      followUpQuestion: redirect.followUpQuestion,
      confidenceLevel: redirect.confidenceLevel,
      offTopic: true,
    });
    logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'POST' }, start);
    return res;
  }

  // Get user profile for grade/board/language
  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { grade: true, board: true, language: true },
  });

  const gradeNum = parseInt(String(userProfile?.grade ?? '8'), 10);
  const board = userProfile?.board ?? 'CBSE';
  const language = userProfile?.language ?? 'en';

  // Create StudentQuestion record in 'processing' state
  let sq;
  if (questionId) {
    // Follow-up on existing question
    sq = await prisma.studentQuestion.findFirst({
      where: { id: questionId, studentId: user.id },
    });
    if (!sq) {
      res = NextResponse.json({ error: 'Question not found' }, { status: 404 });
      logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'POST' }, start);
      return res;
    }
  } else {
    sq = await prisma.studentQuestion.create({
      data: {
        studentId: user.id,
        type: 'doubt',
        subject: studentSubject,
        grade: String(gradeNum),
        content: question,
        status: 'processing',
        aiMetadata: { intent: intent ?? 'conceptual_clarity', chapter: studentChapter, topic: studentTopic },
      },
    });
  }

  // Enqueue AI worker job (LLM calls are worker-only)
  try {
    const { getAIRequestQueue } = await import('@/queues/aiQueue');
    const q = getAIRequestQueue();

    const prompt = buildDoubtsPrompt({
      grade: (isNaN(gradeNum) ? 8 : gradeNum) as any,
      board: board as any,
      language: language as any,
      subject: studentSubject,
      chapter: studentChapter,
      topic: studentTopic,
      studentQuestion: question,
      studentIntent: intent ?? 'conceptual_clarity',
      conversationHistory,
    });

    const job = await q.add('AI_DOUBT', {
      type: 'AI_DOUBT',
      payload: {
        prompt,
        messages: [{ role: 'user', content: question }],
        meta: {
          promptType: 'doubts',
          board,
          grade: gradeNum,
          subject: studentSubject,
          chapter: studentChapter,
          topic: studentTopic,
          questionId: sq.id,
          studentId: user.id,
          language,
        },
      },
    });

    // Low-latency hybrid: briefly wait for worker completion before falling back to async polling.
    const waitStart = Date.now();
    let latest = await prisma.studentQuestion.findUnique({
      where: { id: sq.id },
      select: { status: true, answerSummary: true, aiMetadata: true },
    });

    while (latest?.status === STATUS_PROCESSING && Date.now() - waitStart < DOUBTS_SYNC_WAIT_MS) {
      await sleep(DOUBTS_POLL_INTERVAL_MS);
      latest = await prisma.studentQuestion.findUnique({
        where: { id: sq.id },
        select: { status: true, answerSummary: true, aiMetadata: true },
      });
    }

    if (latest?.status === STATUS_ANSWERED && latest.answerSummary) {
      const metadata = (latest.aiMetadata && typeof latest.aiMetadata === 'object')
        ? (latest.aiMetadata as Record<string, unknown>)
        : {};

      res = NextResponse.json({
        questionId: sq.id,
        response: latest.answerSummary,
        followUpQuestion: String(metadata.followUpQuestion ?? ''),
        confidenceLevel: String(metadata.confidenceLevel ?? 'medium'),
      });
      logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'POST' }, start);
      return res;
    }

    res = NextResponse.json(
      {
        status: 'queued',
        jobId: job.id,
        questionId: sq.id,
        message: 'Your question is being answered. Check back soon!',
      },
      { status: 202 },
    );
    logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'POST' }, start);
    return res;
  } catch (err: any) {
    logger.warn('DoubtsAPI: Failed to enqueue AI job, returning fallback', {
      error: err?.message,
      questionId: sq.id,
      userId: user.id,
    });

    // Fallback: return generic safe response + update question status
    const aiResponse = FALLBACK_RESPONSE;

    await prisma.studentQuestion.update({
      where: { id: sq.id },
      data: {
        status: 'answered',
        answeredAt: new Date(),
        answerSummary: aiResponse.response,
        answerStepsJson: null,
        aiMetadata: {
          ...(typeof sq.aiMetadata === 'object' && sq.aiMetadata !== null ? sq.aiMetadata : {}),
          followUpQuestion: aiResponse.followUpQuestion,
          confidenceLevel: aiResponse.confidenceLevel,
          fallback: true,
          fallbackReason: 'queue_unavailable',
        },
      },
    });

    // Record the fallback answer
    await prisma.questionAnswer.create({
      data: {
        questionId: sq.id,
        responder: 'ai',
        content: aiResponse.response,
        contentJson: aiResponse,
      },
    });

    res = NextResponse.json({
      questionId: sq.id,
      response: aiResponse.response,
      followUpQuestion: aiResponse.followUpQuestion,
      confidenceLevel: aiResponse.confidenceLevel,
      fallback: true,
    });
    logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'POST' }, start);
    return res;
  }
}

/**
 * GET /api/doubts?questionId=xxx
 * Returns the conversation history for a given question.
 */
export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'GET' }, start);
    return res;
  }

  const { searchParams } = new URL(req.url);
  const questionId = searchParams.get('questionId');

  if (questionId) {
    // Get specific question with answers
    const sq = await prisma.studentQuestion.findFirst({
      where: { id: questionId, studentId: user.id },
      include: { answers: { orderBy: { createdAt: 'asc' } } },
    });
    if (!sq) {
      res = NextResponse.json({ error: 'Question not found' }, { status: 404 });
      logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'GET' }, start);
      return res;
    }
    res = NextResponse.json({ question: sq });
  } else {
    // List recent questions
    const questions = await prisma.studentQuestion.findMany({
      where: { studentId: user.id, type: 'doubt' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        subject: true,
        content: true,
        status: true,
        answerSummary: true,
        createdAt: true,
        answeredAt: true,
      },
    });
    res = NextResponse.json({ questions });
  }

  logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'GET' }, start);
  return res;
}
