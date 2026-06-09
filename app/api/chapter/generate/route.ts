/**
 * FILE OBJECTIVE:
 * - POST /api/chapter/generate: on-demand AI content generation for chapter sessions.
 *   Handles content types: topics (chapter overview), syllabus, topic-deep-dive,
 *   practice, quiz, and homework. Streams via SSE. Checks daily credit limits and
 *   deducts fractional credits based on difficulty (1-5 scale).
 *
 * EDIT LOG:
 * - 2026-06-09T12:00:00Z | claude | initial implementation for chapter session on-demand generation
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import { getDailyUsage, getDailyLimit, incrementDailyUsageBy } from '@/lib/credits/dailyCredits';
import OpenAI from 'openai';

// ─── Constants ────────────────────────────────────────────────────────────────

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'X-Accel-Buffering': 'no',
} as const;

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const CACHE_TOKEN_DELAY_MS = 8;

// Credit cost per question/item by difficulty level (1-5 scale)
const DIFFICULTY_CREDIT_COST: Record<number, number> = {
  1: 0.5,
  2: 0.75,
  3: 1.0,
  4: 1.25,
  5: 1.5,
};

// ─── Lazy OpenAI singleton ────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// ─── Validation schema ────────────────────────────────────────────────────────

const bodySchema = z.object({
  chapterName: z.string().min(1),
  subject: z.string().min(1),
  grade: z.string().min(1),
  board: z.string().min(1),
  contentType: z.enum(['topics', 'syllabus', 'topic-deep-dive', 'practice', 'quiz', 'homework']),
  // For topic-deep-dive
  topicTitle: z.string().optional(),
  // For practice / quiz / homework
  difficulty: z.number().int().min(1).max(5).optional(),
  count: z.number().int().min(1).max(15).optional(),
});

type ChapterGenerateBody = z.infer<typeof bodySchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildCacheKey(body: ChapterGenerateBody): string {
  const parts = [
    'chgen',
    slugify(body.board),
    slugify(body.grade),
    slugify(body.subject),
    slugify(body.chapterName),
    body.contentType,
  ];
  if (body.topicTitle) parts.push(slugify(body.topicTitle));
  if (body.difficulty) parts.push(String(body.difficulty));
  if (body.count) parts.push(String(body.count));
  return parts.join(':');
}

function buildPrompts(body: ChapterGenerateBody): { system: string; user: string } {
  const context = `${body.board} curriculum, ${body.subject}, Grade ${body.grade}`;

  switch (body.contentType) {
    case 'topics':
      return {
        system: `You are a ${context} curriculum expert. Generate a structured topic list for a chapter.
Always use Indian educational context and examples.
Format each topic as:
**Topic Name**
One to two sentences describing what the student will learn.

Include all major topics. Be concise but informative.`,
        user: `List all topics in the chapter "${body.chapterName}" for ${context}.`,
      };

    case 'syllabus':
      return {
        system: `You are a ${context} curriculum expert. Generate a detailed syllabus for a chapter.
Structure it with: Learning Objectives, Key Concepts, Sub-topics, Expected Outcomes.
Use Indian educational standards and examples.`,
        user: `Generate a complete syllabus for chapter "${body.chapterName}" in ${context}.`,
      };

    case 'topic-deep-dive': {
      const topic = body.topicTitle ?? body.chapterName;
      return {
        system: `You are a ${context} expert teacher. Explain a concept deeply for a student.
Include: definition, intuition, worked examples with Indian context, common mistakes, memory tips.
Use clear, simple language. Format in Markdown.`,
        user: `Give a deep-dive explanation of "${topic}" from chapter "${body.chapterName}" for ${context}.`,
      };
    }

    case 'practice': {
      const diff = body.difficulty ?? 3;
      const cnt = body.count ?? 5;
      return {
        system: `You are a ${context} exam expert. Generate open-ended practice exercises.
Use Indian context (names, cities, currencies). Calibrate difficulty ${diff}/5:
  1: Very simple, recall-level, one step.
  2: Easy, direct application.
  3: Standard curriculum level, 2-3 steps.
  4: Advanced, multi-step, higher-order thinking.
  5: Expert level, exam-hard, requires deep understanding.
Format as numbered list. Each exercise complete and self-contained.
Include marks allocation (e.g. [3 marks]).`,
        user: `Generate ${cnt} practice exercises for chapter "${body.chapterName}" in ${context} at difficulty ${diff}/5.`,
      };
    }

    case 'quiz': {
      const diff = body.difficulty ?? 3;
      const cnt = body.count ?? 5;
      return {
        system: `You are a ${context} exam expert. Generate multiple-choice quiz questions.
Use Indian context. Calibrate difficulty ${diff}/5:
  1: Very Easy -- recall or recognition.
  2: Easy -- simple application.
  3: Average -- standard curriculum.
  4: Advanced -- higher-order thinking.
  5: Expert -- complex reasoning, exam-level.
Format each question as:
Q[n]. [Question text]
a) [Option A]
b) [Option B]
c) [Option C]
d) [Option D]
Answer: [correct option letter]`,
        user: `Generate ${cnt} multiple-choice quiz questions for chapter "${body.chapterName}" in ${context} at difficulty ${diff}/5.`,
      };
    }

    case 'homework': {
      const diff = body.difficulty ?? 3;
      const cnt = body.count ?? 5;
      return {
        system: `You are a ${context} teacher creating homework assignments.
Use real-world Indian context (daily life, local examples). Calibrate difficulty ${diff}/5:
  1: Very Easy -- direct recall or simple calculation.
  2: Easy -- straightforward application.
  3: Average -- requires understanding and 2-3 steps.
  4: Advanced -- multi-concept, analytical.
  5: Expert -- exam-level challenge.
Format as numbered list with marks. Include a brief hint in brackets.`,
        user: `Create ${cnt} homework problems for chapter "${body.chapterName}" in ${context} at difficulty ${diff}/5.`,
      };
    }

    default:
      return {
        system: `You are a ${context} curriculum expert.`,
        user: `Generate content for chapter "${body.chapterName}" in ${context}.`,
      };
  }
}

function sseEvent(payload: object): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

const SSE_DONE = 'data: [DONE]\n\n';

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let sessionUserId: string;
  try {
    const session = await getServerSessionForHandlers();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    sessionUserId = (session as { user: { id: string } }).user.id;
  } catch (e) {
    logger.error('chapter.generate.session.failed', { error: String(e) });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: ChapterGenerateBody;
  try {
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_request', details: parsed.error.flatten() }, { status: 400 });
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Calculate credit cost for this request
  const needsCredits = ['practice', 'quiz', 'homework'].includes(body.contentType);
  const creditCost = needsCredits
    ? (DIFFICULTY_CREDIT_COST[body.difficulty ?? 3] ?? 1.0) * (body.count ?? 5)
    : 1.0; // topics / syllabus / deep-dive cost 1 credit flat

  const encoder = new TextEncoder();

  let priorUsage = 0;
  let dailyLimit = 50;
  try {
    [priorUsage, dailyLimit] = await Promise.all([
      getDailyUsage(sessionUserId),
      getDailyLimit(sessionUserId),
    ]);
  } catch (e) {
    logger.error('chapter.generate.credits.prefetch.failed', { error: String(e) });
  }

  if (priorUsage + creditCost > dailyLimit) {
    const limitStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseEvent({ error: 'daily_limit_reached', used: priorUsage, limit: dailyLimit })));
        controller.enqueue(encoder.encode(SSE_DONE));
        controller.close();
      },
    });
    return new Response(limitStream, { headers: SSE_HEADERS });
  }

  const cacheKey = buildCacheKey(body);

  // Cache hit: replay with token delay
  try {
    const redis = getRedis();
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const cachedStream = new ReadableStream({
          async start(controller) {
            try {
              for (const char of cached) {
                controller.enqueue(encoder.encode(sseEvent({ token: char })));
                await new Promise<void>((resolve) => setTimeout(resolve, CACHE_TOKEN_DELAY_MS));
              }
              incrementDailyUsageBy(sessionUserId, creditCost).catch((e: unknown) => {
                logger.error('chapter.generate.credits.increment.failed', { error: String(e) });
              });
              controller.enqueue(encoder.encode(sseEvent({
                meta: { creditsUsed: priorUsage + creditCost, creditsLimit: dailyLimit, creditCost },
              })));
              controller.enqueue(encoder.encode(SSE_DONE));
              controller.close();
            } catch (e) {
              logger.error('chapter.generate.cached.stream.error', { error: String(e) });
              try { controller.enqueue(encoder.encode(sseEvent({ error: 'upstream_error' }))); controller.close(); } catch { /* ignore */ }
            }
          },
        });
        return new Response(cachedStream, { headers: SSE_HEADERS });
      }
    }
  } catch (e) {
    logger.error('chapter.generate.cache.read.failed', { cacheKey, error: String(e) });
  }

  const { system, user } = buildPrompts(body);

  const liveStream = new ReadableStream({
    async start(controller) {
      let fullReply = '';
      try {
        const openaiStream = await getOpenAIClient().chat.completions.create({
          model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          stream: true,
        });

        for await (const chunk of openaiStream) {
          const token = chunk.choices[0]?.delta?.content || '';
          if (token) {
            fullReply += token;
            controller.enqueue(encoder.encode(sseEvent({ token })));
          }
        }

        incrementDailyUsageBy(sessionUserId, creditCost).catch((e: unknown) => {
          logger.error('chapter.generate.credits.increment.failed', { error: String(e) });
        });
        controller.enqueue(encoder.encode(sseEvent({
          meta: { creditsUsed: priorUsage + creditCost, creditsLimit: dailyLimit, creditCost },
        })));
        controller.enqueue(encoder.encode(SSE_DONE));
        controller.close();

        if (fullReply) {
          try {
            const redis = getRedis();
            if (redis) {
              redis.set(cacheKey, fullReply, 'EX', CACHE_TTL_SECONDS).catch((e: unknown) => {
                logger.error('chapter.generate.cache.write.failed', { cacheKey, error: String(e) });
              });
            }
          } catch (e) {
            logger.error('chapter.generate.cache.write.outer.failed', { cacheKey, error: String(e) });
          }
        }
      } catch (e) {
        logger.error('chapter.generate.stream.error', { error: String(e) });
        try {
          controller.enqueue(encoder.encode(sseEvent({ error: 'upstream_error' })));
          controller.close();
        } catch { /* controller may already be closed */ }
      }
    },
  });

  return new Response(liveStream, { headers: SSE_HEADERS });
}
