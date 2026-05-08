/**
 * FILE OBJECTIVE:
 * - Handle student doubt submissions with auth, safety checks, direct LLM responses, and persisted Q&A records.
 * - Return immediate Vidya responses to keep the doubts chat experience real-time for students.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/doubts/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | move doubts LLM to worker queue and add short synchronous wait for fast responses
 * - 2026-05-08T00:00:00Z | copilot | restore direct synchronous doubts LLM path and remove queued/check-back response
 * - 2026-05-08T00:00:00Z | copilot | enforce daily free-question quota in doubts route with consume/refund and retry-safe behavior
 * - 2026-05-08T00:00:00Z | copilot | return and persist doubts follow-up questions as an array for clickable UI bubbles
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { generateDoubtResponse } from '@/lib/ai/prompts/promptBuilder';
import {
  isOffTopicQuestion,
  getOffTopicRedirect,
} from '@/lib/ai/prompts/doubts';
import type { StudentIntent, ConversationMessage } from '@/lib/ai/prompts/schemas';
import { consumeDailyFreeQuestionQuota, refundDailyFreeQuestionQuota } from '@/lib/freeQuestionQuota';

export const dynamic = 'force-dynamic';

const FALLBACK_RESPONSE = {
  response: `I am having a little trouble connecting right now, so I cannot give you a full explanation at this moment.\n\nPlease try asking again in a few seconds -- I want to give you a proper, detailed answer with examples, not a quick summary. Your question deserves a real explanation!`,
  followUpQuestions: [`Could you try asking again? I want to make sure I explain your question properly with examples.`],
  confidenceLevel: 'low' as const,
};

const QUESTION_TYPE_DOUBT = 'doubt';
const STATUS_PROCESSING = 'processing';
const STATUS_ANSWERED = 'answered';
const FALLBACK_REASON_LLM_UNAVAILABLE = 'llm_unavailable';
const ERROR_FREE_LIMIT_REACHED = 'free_limit_reached';
const ERROR_NOT_FOUND = 'not_found';
const ERROR_QUESTION_NOT_FOUND = 'Question not found';

type QuotaRefundMethod = 'column' | 'freemium';

type DoubtsMetadata = {
  followUpQuestions?: string[];
  followUpQuestion?: string;
  confidenceLevel?: string;
};

function normalizeFollowUpQuestions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return [value];
  }

  return [];
}

function getStoredFollowUpQuestions(metadata: DoubtsMetadata | null | undefined): string[] {
  const normalizedFollowUps = normalizeFollowUpQuestions(metadata?.followUpQuestions);
  if (normalizedFollowUps.length > 0) {
    return normalizedFollowUps;
  }

  return normalizeFollowUpQuestions(metadata?.followUpQuestion);
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
 * Generates direct AI response in-request and returns fallback if generation fails.
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
        type: QUESTION_TYPE_DOUBT,
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
      followUpQuestions: redirect.followUpQuestions,
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
  let quotaRefundMethod: QuotaRefundMethod | null = null;
  if (questionId) {
    // Follow-up on existing question
    sq = await prisma.studentQuestion.findFirst({
      where: { id: questionId, studentId: user.id },
    });
    if (!sq) {
      res = NextResponse.json({ error: ERROR_QUESTION_NOT_FOUND }, { status: 404 });
      logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'POST' }, start);
      return res;
    }

    const existingContent = typeof sq.content === 'string' ? sq.content.trim() : '';
    const incomingContent = question.trim();
    const isAnswered = sq.status === STATUS_ANSWERED;
    const hasStoredAnswer = typeof sq.answerSummary === 'string' && sq.answerSummary.trim().length > 0;
    const isRetryRequest = isAnswered && hasStoredAnswer && existingContent === incomingContent;

    if (isRetryRequest) {
      const metadata = typeof sq.aiMetadata === 'object' && sq.aiMetadata !== null
        ? (sq.aiMetadata as DoubtsMetadata)
        : {};

      res = NextResponse.json({
        questionId: sq.id,
        response: sq.answerSummary,
        followUpQuestions: getStoredFollowUpQuestions(metadata).length > 0
          ? getStoredFollowUpQuestions(metadata)
          : FALLBACK_RESPONSE.followUpQuestions,
        confidenceLevel: metadata.confidenceLevel ?? FALLBACK_RESPONSE.confidenceLevel,
        retried: true,
      });
      logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'POST' }, start);
      return res;
    }

    const consumeResult = await consumeDailyFreeQuestionQuota(user.id);
    if (consumeResult.status === 'not_found') {
      res = NextResponse.json({ error: ERROR_NOT_FOUND }, { status: 404 });
      logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'POST' }, start);
      return res;
    }

    if (consumeResult.status === 'limit_reached') {
      res = NextResponse.json({ error: ERROR_FREE_LIMIT_REACHED }, { status: 403 });
      logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'POST' }, start);
      return res;
    }

    if (consumeResult.charged && consumeResult.method !== 'premium') {
      quotaRefundMethod = consumeResult.method;
    }
  } else {
    const consumeResult = await consumeDailyFreeQuestionQuota(user.id);
    if (consumeResult.status === 'not_found') {
      res = NextResponse.json({ error: ERROR_NOT_FOUND }, { status: 404 });
      logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'POST' }, start);
      return res;
    }

    if (consumeResult.status === 'limit_reached') {
      res = NextResponse.json({ error: ERROR_FREE_LIMIT_REACHED }, { status: 403 });
      logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'POST' }, start);
      return res;
    }

    if (consumeResult.charged && consumeResult.method !== 'premium') {
      quotaRefundMethod = consumeResult.method;
    }

    sq = await prisma.studentQuestion.create({
      data: {
        studentId: user.id,
        type: QUESTION_TYPE_DOUBT,
        subject: studentSubject,
        grade: String(gradeNum),
        content: question,
        status: STATUS_PROCESSING,
        aiMetadata: { intent: intent ?? 'conceptual_clarity', chapter: studentChapter, topic: studentTopic },
      },
    });
  }

  // Direct LLM flow for immediate chat-like response.
  try {
    const doubtResult = await generateDoubtResponse(
      {
      grade: (isNaN(gradeNum) ? 8 : gradeNum) as any,
      board: board as any,
      language: language as any,
      subject: studentSubject,
      chapter: studentChapter,
      topic: studentTopic,
      studentQuestion: question,
      studentIntent: intent ?? 'conceptual_clarity',
      conversationHistory,
      },
      user.id,
      sq.id,
    );

    if (!doubtResult.success || !doubtResult.data) {
      throw new Error(doubtResult.error ?? 'Doubt response generation failed');
    }

    const aiResponse = doubtResult.data;

    await prisma.studentQuestion.update({
      where: { id: sq.id },
      data: {
        status: STATUS_ANSWERED,
        answeredAt: new Date(),
        answerSummary: aiResponse.response,
        answerStepsJson: null,
        aiMetadata: {
          ...(typeof sq.aiMetadata === 'object' && sq.aiMetadata !== null ? sq.aiMetadata : {}),
          followUpQuestions: aiResponse.followUpQuestions,
          confidenceLevel: aiResponse.confidenceLevel,
          directLLM: true,
        },
      },
    });

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
      followUpQuestions: aiResponse.followUpQuestions,
      confidenceLevel: aiResponse.confidenceLevel,
    });
    logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'POST' }, start);
    return res;
  } catch (err: any) {
    logger.warn('DoubtsAPI: Failed to generate direct AI response, returning fallback', {
      error: err?.message,
      questionId: sq.id,
      userId: user.id,
    });

    if (quotaRefundMethod) {
      await refundDailyFreeQuestionQuota(user.id, quotaRefundMethod);
    }

    // Fallback: return generic safe response + update question status
    const aiResponse = FALLBACK_RESPONSE;

    await prisma.studentQuestion.update({
      where: { id: sq.id },
      data: {
        status: STATUS_ANSWERED,
        answeredAt: new Date(),
        answerSummary: aiResponse.response,
        answerStepsJson: null,
        aiMetadata: {
          ...(typeof sq.aiMetadata === 'object' && sq.aiMetadata !== null ? sq.aiMetadata : {}),
          followUpQuestions: aiResponse.followUpQuestions,
          confidenceLevel: aiResponse.confidenceLevel,
          fallback: true,
          fallbackReason: FALLBACK_REASON_LLM_UNAVAILABLE,
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
      followUpQuestions: aiResponse.followUpQuestions,
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
      where: { studentId: user.id, type: QUESTION_TYPE_DOUBT },
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
