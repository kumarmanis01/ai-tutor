/**
 * FILE OBJECTIVE:
 * - POST /api/concept/deep-dive: streams a focused deeper explanation of a single
 *   concept for on-demand learning. Caches responses in Redis (7d TTL) and checks
 *   daily credit limits. Cache key includes board/grade/subject/topic/concept/difficulty.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial implementation for Deep Dive per-concept card (task S3-1)
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
const CACHE_KEY_PREFIX = 'deepdive';

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
  conceptTitle: z.string().min(1),
  difficulty: z.number().int().min(1).max(10),
});

type DeepDiveBody = z.infer<typeof bodySchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildCacheKey(body: DeepDiveBody): string {
  return [
    CACHE_KEY_PREFIX,
    slugify(body.board),
    slugify(body.grade),
    slugify(body.subject),
    slugify(body.topicSlug),
    slugify(body.conceptTitle),
    String(body.difficulty),
  ].join(':');
}

function buildSystemPrompt(difficulty: number): string {
  const calibration =
    difficulty <= 3
      ? '1-3: like explaining to a younger sibling, use stories and analogies.'
      : difficulty <= 6
      ? '4-6: clear textbook-level explanation with one worked example.'
      : '7-10: deep explanation, real-world applications, potential exam angles.';

  return `You are a CBSE/ICSE curriculum expert explaining a concept to an Indian student. Use Indian context, familiar examples, and simple analogies. Be thorough but focused -- explain only this one concept.
Calibrate to difficulty ${difficulty}/10:
  ${calibration}
Format: flowing paragraphs, not bullet points. 150-250 words maximum.`;
}

function buildUserPrompt(body: DeepDiveBody): string {
  return `Explain "${body.conceptTitle}" for ${body.subject}, grade ${body.grade}, ${body.board}. Topic context: ${body.topicSlug}.`;
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
    logger.error('deep-dive.api.session.failed', { error: String(e) });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Parse and validate request body
  let body: DeepDiveBody;
  try {
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_request', details: parsed.error.flatten() },
        { status: 400 },
      );
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
    logger.error('deep-dive.api.credits.prefetch.failed', { error: String(e) });
  }

  if (priorUsage >= dailyLimit) {
    const encoder = new TextEncoder();
    const limitStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            sseEvent({ error: 'daily_limit_reached', used: priorUsage, limit: dailyLimit }),
          ),
        );
        controller.enqueue(encoder.encode(SSE_DONE));
        controller.close();
      },
    });
    return new Response(limitStream, { headers: SSE_HEADERS });
  }

  const cacheKey = buildCacheKey(body);
  const encoder = new TextEncoder();

  // Cache hit: fake-stream the cached string with short token delay
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
                logger.error('deep-dive.api.credits.increment.failed', { error: String(e) });
              });
              controller.enqueue(
                encoder.encode(
                  sseEvent({ meta: { creditsUsed: priorUsage + 1, creditsLimit: dailyLimit } }),
                ),
              );
              controller.enqueue(encoder.encode(SSE_DONE));
              controller.close();
            } catch (e) {
              logger.error('deep-dive.api.cached.stream.error', { error: String(e) });
              try {
                controller.enqueue(encoder.encode(sseEvent({ error: 'upstream_error' })));
                controller.close();
              } catch { /* controller may already be closed */ }
            }
          },
        });
        return new Response(cachedStream, { headers: SSE_HEADERS });
      }
    }
  } catch (e) {
    // Redis failure is non-fatal -- fall through to OpenAI
    logger.error('deep-dive.api.cache.read.failed', { cacheKey, error: String(e) });
  }

  // Cache miss: call OpenAI with streaming
  const systemPrompt = buildSystemPrompt(body.difficulty);
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
          logger.error('deep-dive.api.credits.increment.failed', { error: String(e) });
        });
        controller.enqueue(
          encoder.encode(
            sseEvent({ meta: { creditsUsed: priorUsage + 1, creditsLimit: dailyLimit } }),
          ),
        );
        controller.enqueue(encoder.encode(SSE_DONE));
        controller.close();

        // Write to cache after stream completes (fire-and-forget)
        if (fullReply) {
          try {
            const redis = getRedis();
            if (redis) {
              redis.set(cacheKey, fullReply, 'EX', CACHE_TTL_SECONDS).catch((e: unknown) => {
                logger.error('deep-dive.api.cache.write.failed', { cacheKey, error: String(e) });
              });
            }
          } catch (e) {
            logger.error('deep-dive.api.cache.write.outer.failed', { cacheKey, error: String(e) });
          }
        }
      } catch (e) {
        logger.error('deep-dive.api.stream.error', { error: String(e) });
        try {
          controller.enqueue(encoder.encode(sseEvent({ error: 'upstream_error' })));
          controller.close();
        } catch { /* controller may already be closed */ }
      }
    },
  });

  return new Response(liveStream, { headers: SSE_HEADERS });
}
