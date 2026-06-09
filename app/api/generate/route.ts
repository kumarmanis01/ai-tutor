/**
 * FILE OBJECTIVE:
 * - POST /api/generate: demand-pull generation of examples, exercises, or quiz items
 *   for a given topic with configurable concept filter, count, and difficulty. Streams via SSE.
 *   Caches responses in Redis (7d TTL) and checks daily credit limits.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial implementation for demand-pull generate flow (task S3)
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import { getDailyUsage, getDailyLimit, incrementDailyUsage } from '@/lib/credits/dailyCredits';
import OpenAI from 'openai';

// ─── Constants ────────────────────────────────────────────────────────────────

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'X-Accel-Buffering': 'no',
} as const;

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const CACHE_TOKEN_DELAY_MS = 8;

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
  topicSlug: z.string().min(1),
  subject: z.string().min(1),
  grade: z.string().min(1),
  board: z.string().min(1),
  contentType: z.enum(['examples', 'exercises', 'quiz']),
  conceptTitle: z.string().nullable(),
  count: z.number().int().min(1).max(10),
  difficulty: z.number().int().min(1).max(10),
});

type GenerateBody = z.infer<typeof bodySchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCacheKey(body: GenerateBody): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [
    'gen',
    slug(body.board),
    slug(body.grade),
    slug(body.subject),
    slug(body.topicSlug),
    slug(body.contentType),
    body.conceptTitle ? slug(body.conceptTitle) : 'mixed',
    String(body.count),
    String(body.difficulty),
  ].join(':');
}

function buildSystemPrompt(body: GenerateBody): string {
  const focusClause = body.conceptTitle
    ? `Focus only on the concept: "${body.conceptTitle}".`
    : 'Cover all concepts mixed.';

  return `You are a ${body.board} curriculum expert generating ${body.contentType} for Indian students.
Always use Indian context, examples, and units.
Generate exactly ${body.count} ${body.contentType}.
${focusClause}
Calibrate difficulty to ${body.difficulty}/10:
  1-3: simple language, concrete real-world examples, step-by-step.
  4-6: standard curriculum level, moderate complexity.
  7-10: advanced reasoning, exam-level, edge cases.
Format: numbered list. Each item complete and self-contained.`;
}

function buildUserPrompt(body: GenerateBody): string {
  return `Generate ${body.count} ${body.contentType} for topic "${body.topicSlug}" subject ${body.subject}, grade ${body.grade}, board ${body.board}.`;
}

function sseEvent(payload: object): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

const SSE_DONE = 'data: [DONE]\n\n';

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Auth guard -- session check before any business logic
  let sessionUserId: string;
  try {
    const session = await getServerSessionForHandlers();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    sessionUserId = (session as any).user.id as string;
  } catch (e) {
    logger.error('generate.api.session.failed', { error: String(e) });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Parse and validate request body
  let body: GenerateBody;
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

  // Credit limit check
  let priorUsage = 0;
  let dailyLimit = 50;
  try {
    [priorUsage, dailyLimit] = await Promise.all([
      getDailyUsage(sessionUserId),
      getDailyLimit(sessionUserId),
    ]);
  } catch (e) {
    logger.error('generate.api.credits.prefetch.failed', { error: String(e) });
  }

  if (priorUsage >= dailyLimit) {
    const encoder = new TextEncoder();
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
  const encoder = new TextEncoder();

  // Cache hit: fake-stream the cached string with 8ms token delay
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
              incrementDailyUsage(sessionUserId).catch((e: unknown) => {
                logger.error('generate.api.credits.increment.failed', { error: String(e) });
              });
              controller.enqueue(encoder.encode(sseEvent({ meta: { creditsUsed: priorUsage + 1, creditsLimit: dailyLimit } })));
              controller.enqueue(encoder.encode(SSE_DONE));
              controller.close();
            } catch (e) {
              logger.error('generate.api.cached.stream.error', { error: String(e) });
              try { controller.enqueue(encoder.encode(sseEvent({ error: 'upstream_error' }))); controller.close(); } catch { /* ignore */ }
            }
          },
        });
        return new Response(cachedStream, { headers: SSE_HEADERS });
      }
    }
  } catch (e) {
    // Redis failure is non-fatal -- fall through to OpenAI
    logger.error('generate.api.cache.read.failed', { cacheKey, error: String(e) });
  }

  // Cache miss: call OpenAI with streaming, model gpt-4o-mini (structured generation, cost-efficient)
  const systemPrompt = buildSystemPrompt(body);
  const userPrompt = buildUserPrompt(body);

  const liveStream = new ReadableStream({
    async start(controller) {
      let fullReply = '';
      try {
        const openaiStream = await getOpenAIClient().chat.completions.create({
          model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
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

        incrementDailyUsage(sessionUserId).catch((e: unknown) => {
          logger.error('generate.api.credits.increment.failed', { error: String(e) });
        });
        controller.enqueue(encoder.encode(sseEvent({ meta: { creditsUsed: priorUsage + 1, creditsLimit: dailyLimit } })));
        controller.enqueue(encoder.encode(SSE_DONE));
        controller.close();

        // Write to cache after stream completes (fire-and-forget)
        if (fullReply) {
          try {
            const redis = getRedis();
            if (redis) {
              redis.set(cacheKey, fullReply, 'EX', CACHE_TTL_SECONDS).catch((e: unknown) => {
                logger.error('generate.api.cache.write.failed', { cacheKey, error: String(e) });
              });
            }
          } catch (e) {
            logger.error('generate.api.cache.write.outer.failed', { cacheKey, error: String(e) });
          }
        }
      } catch (e) {
        logger.error('generate.api.stream.error', { error: String(e) });
        try {
          controller.enqueue(encoder.encode(sseEvent({ error: 'upstream_error' })));
          controller.close();
        } catch { /* controller may already be closed */ }
      }
    },
  });

  return new Response(liveStream, { headers: SSE_HEADERS });
}
