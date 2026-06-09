/**
 * FILE OBJECTIVE:
 * - POST /api/chapter/generate: on-demand AI content generation for chapter sessions.
 *   All content types stream Markdown via SSE. Checks daily credit limits.
 *   Prompt logic delegates to dedicated pipeline slice files:
 *     lib/chapter/syllabusSlice.ts  (topics list)
 *     lib/chapter/notesSlice.ts     (curriculum, concepts, examples)
 *     lib/chapter/questionsSlice.ts (quiz, exercises, homework)
 *
 * EDIT LOG:
 * - 2026-06-09T19:00:00Z | claude | import from dedicated slice files; add topic-concepts
 *     and topic-examples content types; remove inline prompt logic
 * - 2026-06-09T17:00:00Z | claude | move prompt logic to lib/chapter/chapterPrompts.ts slices
 * - 2026-06-09T12:00:00Z | claude | initial implementation for chapter session on-demand generation
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import { getDailyUsage, getDailyLimit, incrementDailyUsageBy } from '@/lib/credits/dailyCredits';
import {
  chapterSyllabusPrompt,
  chapterTopicsListPrompt,
} from '@/lib/chapter/syllabusSlice';
import {
  chapterCurriculumPrompt,
  chapterConceptsPrompt,
  chapterExamplesPrompt,
} from '@/lib/chapter/notesSlice';
import {
  chapterQuizSlice,
  chapterPracticeSlice,
  chapterHomeworkSlice,
} from '@/lib/chapter/questionsSlice';
import OpenAI from 'openai';

// ─── Constants ────────────────────────────────────────────────────────────────

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'X-Accel-Buffering': 'no',
} as const;

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const CACHE_TOKEN_DELAY_MS = 8;

// Credit cost per item by difficulty level (1-5 scale)
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
  contentType: z.enum([
    'syllabus',
    'topics',
    'topic-curriculum',
    'topic-concepts',
    'topic-examples',
    'quiz',
    'exercises',
    'homework',
  ]),
  topicTitle: z.string().optional(),
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
    'chgen2',
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

// ─── Prompt builder -- delegates to pipeline slice files ──────────────────────

function buildPrompts(body: ChapterGenerateBody): { system: string; user: string } {
  const ctx = {
    chapterName: body.chapterName,
    subject: body.subject,
    grade: body.grade,
    board: body.board,
  };
  const topicTitle = body.topicTitle ?? body.chapterName;
  const noteCtx = { ...ctx, topicTitle };
  const qCtx = {
    ...ctx,
    topicTitle,
    difficultyLevel: body.difficulty ?? 3,
    count: body.count ?? 5,
  };

  switch (body.contentType) {
    case 'syllabus':         return chapterSyllabusPrompt(ctx);
    case 'topics':           return chapterTopicsListPrompt(ctx);
    case 'topic-curriculum': return chapterCurriculumPrompt(noteCtx);
    case 'topic-concepts':   return chapterConceptsPrompt(noteCtx);
    case 'topic-examples':   return chapterExamplesPrompt(noteCtx);
    case 'quiz':             return chapterQuizSlice(qCtx);
    case 'exercises':        return chapterPracticeSlice(qCtx);
    case 'homework':         return chapterHomeworkSlice(qCtx);
    default:
      return {
        system: `You are Vidya, an expert AI tutor for Indian K-12 students (${body.board}).`,
        user: `Generate educational content for chapter "${body.chapterName}" (${body.board} Grade ${body.grade} ${body.subject}).`,
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

  // Credit cost: question tabs cost per item; content tabs cost 1 credit flat
  const isQuestions = ['quiz', 'exercises', 'homework'].includes(body.contentType);
  const creditCost = isQuestions
    ? (DIFFICULTY_CREDIT_COST[body.difficulty ?? 3] ?? 1.0) * (body.count ?? 5)
    : 1.0;

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
