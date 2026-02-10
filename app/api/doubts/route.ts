import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import {
  buildDoubtsPrompt,
  isValidDoubtsResponse,
  isOffTopicQuestion,
  getOffTopicRedirect,
} from '@/lib/ai/prompts/doubts';
import type { StudentIntent, ConversationMessage } from '@/lib/ai/prompts/schemas';

export const dynamic = 'force-dynamic';

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
 * Creates a StudentQuestion record and returns the AI response.
 * Falls back to a helpful static response if LLM is unavailable.
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

  // Build the prompt using the existing prompt builder
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

  // Create or update StudentQuestion record
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

  // Try LLM call — if unavailable, return a helpful fallback
  let aiResponse: { response: string; followUpQuestion: string; confidenceLevel: string };

  try {
    // Dynamic import to avoid pulling in OpenAI client at build time
    const { callLLM } = await import('@/lib/callLLM');
    const llmResult = await callLLM({
      prompt,
      meta: {
        promptType: 'doubts',
        board,
        grade: gradeNum,
        subject: studentSubject,
        chapter: studentChapter,
        topic: studentTopic,
        suppressLog: false,
      },
      timeoutMs: 15_000,
    });

    const parsed = JSON.parse(llmResult.content);
    if (isValidDoubtsResponse(parsed)) {
      aiResponse = parsed;
    } else {
      throw new Error('Invalid LLM response structure');
    }
  } catch (err: any) {
    logger.warn('DoubtsAPI: LLM unavailable, using fallback', {
      error: err?.message,
      questionId: sq.id,
    });

    // Fallback response when LLM is not available
    aiResponse = {
      response: `Great question about ${studentTopic || studentSubject}! Let me help you understand this better.\n\nThis is a topic that many students find interesting. To get the best answer, try breaking your question into smaller parts and reviewing the notes on this topic first. The key concepts will help you build a strong foundation.`,
      followUpQuestion: `What specific part of ${studentTopic || studentSubject} would you like to explore further?`,
      confidenceLevel: 'low',
    };
  }

  // Update StudentQuestion with answer
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
      },
    },
  });

  // Also record the AI answer in QuestionAnswer
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
  });
  logger.logAPI(req, res, { className: 'DoubtsAPI', methodName: 'POST' }, start);
  return res;
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
