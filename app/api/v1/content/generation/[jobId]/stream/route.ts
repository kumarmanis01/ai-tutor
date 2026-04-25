/**
 * FILE OBJECTIVE:
 * - GET /api/v1/content/generation/[jobId]/stream -- Server-Sent Events endpoint
 *   that streams AI generation progress to the student client. Subscribes to
 *   Redis pub/sub and sends partial/complete/error events.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/content/generation/[jobId]/stream/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created -- B4.3 SSE content generation stream
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import Redis from 'ioredis';

// ── Constants ─────────────────────────────────────────────────────────────────

/** 120 seconds max streaming time per spec */
const STREAM_TIMEOUT_MS = 120_000;
/** SSE keepalive ping interval */
const KEEPALIVE_INTERVAL_MS = 15_000;

// ── SSE helpers ───────────────────────────────────────────────────────────────

function sseEvent(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  // Auth guard
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(sseEvent('error', { message: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }

  const { jobId } = await params;
  const userId = session.user.id;

  // Verify the user owns or is subscribed to this job
  let job;
  try {
    job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      select: { createdById: true, subscriberIds: true, status: true, contentId: true },
    });
  } catch (err: unknown) {
    logger.error('SSE: DB lookup failed', { jobId, error: err });
    return new Response(sseEvent('error', { message: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }

  if (!job) {
    return new Response(sseEvent('error', { message: 'Job not found' }), {
      status: 404,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }

  const isAuthorized = job.createdById === userId || job.subscriberIds.includes(userId);
  if (!isAuthorized) {
    return new Response(sseEvent('error', { message: 'Access denied' }), {
      status: 403,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }

  // If already completed, send the complete event immediately
  if (job.status === 'COMPLETED' && job.contentId) {
    const body = sseEvent('complete', { contentId: job.contentId, fullContent: null });
    return new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  if (job.status === 'FAILED') {
    return new Response(sseEvent('error', { message: 'Content generation failed' }), {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }

  // Set up streaming
  const encoder = new TextEncoder();
  const redis = getRedis();

  const stream = new ReadableStream({
    async start(controller) {
      // Create a dedicated subscriber connection (required for pub/sub in Redis)
      const subscriber = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      let isClosed = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      let keepaliveHandle: ReturnType<typeof setInterval> | null = null;

      function cleanup() {
        if (isClosed) return;
        isClosed = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (keepaliveHandle) clearInterval(keepaliveHandle);
        subscriber.unsubscribe().catch(() => {});
        subscriber.disconnect();
      }

      function send(event: string, data: unknown) {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          cleanup();
        }
      }

      // Send any already-available partial content from Redis
      try {
        const existingPartial = await redis.get(`content_gen:${jobId}:partial`);
        if (existingPartial) {
          const parsed = JSON.parse(existingPartial) as { content: string; progress: number };
          send('partial', parsed);
        }
      } catch (err: unknown) {
        logger.warn('SSE: Failed to read partial from Redis', { jobId, error: err });
      }

      // Subscribe to pub/sub updates
      try {
        await subscriber.connect();
        await subscriber.subscribe(`content_gen:${jobId}:updates`);

        subscriber.on('message', (_channel: string, message: string) => {
          try {
            const event = JSON.parse(message) as {
              type: string;
              content?: string;
              progress?: number;
              contentId?: string;
              fullContent?: string;
              message?: string;
            };

            if (event.type === 'partial') {
              send('partial', { content: event.content, progress: event.progress });
            } else if (event.type === 'complete') {
              send('complete', { contentId: event.contentId, fullContent: event.fullContent });
              cleanup();
              controller.close();
            } else if (event.type === 'error') {
              send('error', { message: event.message ?? 'Generation failed' });
              cleanup();
              controller.close();
            }
          } catch (parseErr: unknown) {
            logger.warn('SSE: Failed to parse pub/sub message', { jobId, error: parseErr });
          }
        });

        subscriber.on('error', (err: Error) => {
          logger.error('SSE: Redis subscriber error', { jobId, error: err });
          cleanup();
        });
      } catch (err: unknown) {
        logger.error('SSE: Failed to subscribe to Redis channel', { jobId, error: err });
        send('error', { message: 'Streaming unavailable, please retry' });
        controller.close();
        cleanup();
        return;
      }

      // Keepalive pings to prevent proxy timeouts
      keepaliveHandle = setInterval(() => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch {
            cleanup();
          }
        }
      }, KEEPALIVE_INTERVAL_MS);

      // 120s timeout
      timeoutHandle = setTimeout(() => {
        if (!isClosed) {
          send('timeout', { message: "We'll notify you when content is ready" });
          cleanup();
          controller.close();
        }
      }, STREAM_TIMEOUT_MS);

      // Handle client disconnect
      req.signal.addEventListener('abort', () => {
        cleanup();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
