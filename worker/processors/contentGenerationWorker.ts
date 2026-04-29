/**
 * FILE OBJECTIVE:
 * - BullMQ Worker that processes AI content generation jobs from the
 *   `content-generation` queue. Calls OpenAI streaming, stores partial results
 *   in Redis for SSE, and creates a Content record on completion.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/processors/contentGenerationWorker.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created -- B4.1 ContentGenerationWorker
 * - 2026-04-26T15:00:00Z | copilot | add non-blocking AIGenerationLog writes for content generation attempts
 */

import { Worker, type Job } from 'bullmq';
import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { getSharedConnection, getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { emitContentGenerated } from '@/lib/socket/server';
import { generationLogService } from '@/lib/ai/generationLogService';

// ── Constants ─────────────────────────────────────────────────────────────────

export const CONTENT_GENERATION_QUEUE = 'content-generation';
/** TTL for partial results in Redis (30 minutes) */
const PARTIAL_TTL_SECONDS = 1800;

// ── Job data interface ────────────────────────────────────────────────────────

export interface ContentGenerationJobData {
  jobId: string;
  topic: string;
  subject: string;
  grade: number;
  board: string;
  language?: 'en' | 'hi';
  requesterId: string;
}

// ── OpenAI client (lazy singleton) ───────────────────────────────────────────

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(data: ContentGenerationJobData): string {
  const langInstruction =
    data.language === 'hi'
      ? 'Respond in Hindi where appropriate, but keep technical terms in English.'
      : 'Respond in clear, simple English suitable for Indian students.';

  return `You are Vidya, an AI tutor for Indian students. Generate a comprehensive study note
on the following topic using a Socratic teaching style. Guide the student to discover concepts
through examples and questions -- never just state facts directly.

Topic: ${data.topic}
Subject: ${data.subject}
Grade: ${data.grade}
Board: ${data.board}
${langInstruction}

Structure your response in Markdown with:
1. A brief engaging introduction (2-3 sentences)
2. Key concepts with relatable Indian examples
3. 2-3 guiding questions to check understanding
4. A short summary

Keep the tone encouraging, never judgmental. Do not exceed 800 words.`;
}

// ── Worker processor ──────────────────────────────────────────────────────────

async function processContentGenerationJob(job: Job<ContentGenerationJobData>): Promise<void> {
  const { jobId, requesterId } = job.data;
  const redis = getRedis();
  if (!redis) {
    throw new Error('Redis unavailable -- cannot process content generation job');
  }
  logger.info('ContentGenerationWorker: starting job', { jobId, topic: job.data.topic });

  // Mark job as PROCESSING in DB
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING' },
  });

  const openai = getOpenAI();
  const prompt = buildPrompt(job.data);
  let fullContent = '';

  try {
    // Use streaming so we can store partials as they arrive
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      max_tokens: 1200,
    });

    let chunkCount = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (!delta) continue;

      fullContent += delta;
      chunkCount++;

      // Store partial result in Redis every 5 chunks to reduce write frequency
      if (chunkCount % 5 === 0) {
        const partial = JSON.stringify({
          content: fullContent,
          progress: Math.min(90, chunkCount * 5),
        });
        await redis.set(`content_gen:${jobId}:partial`, partial, 'EX', PARTIAL_TTL_SECONDS);
        // Publish to pub/sub channel for SSE clients
        await redis.publish(
          `content_gen:${jobId}:updates`,
          JSON.stringify({
            type: 'partial',
            content: fullContent,
            progress: Math.min(90, chunkCount * 5),
          })
        );
      }
    }

    // Final partial update
    await redis.set(
      `content_gen:${jobId}:partial`,
      JSON.stringify({ content: fullContent, progress: 100 }),
      'EX',
      PARTIAL_TTL_SECONDS
    );
  } catch (err: unknown) {
    logger.error('ContentGenerationWorker: OpenAI streaming failed', { jobId, error: err });
    void generationLogService.logGeneration({
      promptType: 'LESSON_GENERATION',
      promptVersion: 'unknown',
      requestVariables: {
        topic: job.data.topic,
        subject: job.data.subject,
        grade: job.data.grade,
        board: job.data.board,
        language: job.data.language ?? 'en',
      },
      responseText: fullContent || null,
      modelName: 'gpt-4o-mini',
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
      retryCount: Math.max(0, (job.attemptsMade ?? 1) - 1),
      userId: requesterId,
      jobId,
    });
    throw err;
  }

  // Create Content record with APPROVED status so it appears in search immediately.
  // Student-requested on-demand content is auto-approved; admin can later flag via ContentFlag.
  const content = await prisma.content.create({
    data: {
      topic: job.data.topic,
      subject: job.data.subject,
      grade: job.data.grade,
      board: job.data.board,
      language: job.data.language === 'hi' ? 'hi' : 'en',
      type: 'AI_GENERATED',
      status: 'APPROVED',
      contentJson: { markdown: fullContent },
      version: 1,
      createdById: requesterId,
    },
    select: { id: true },
  });

  // Link content to generation job and mark COMPLETED
  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      contentId: content.id,
    },
  });

  // Publish completion event to all SSE subscribers
  await redis.publish(
    `content_gen:${jobId}:updates`,
    JSON.stringify({ type: 'complete', contentId: content.id, fullContent })
  );

  // Notify all subscribers via Socket.IO rooms.
  try {
    const jobState = await prisma.generationJob.findUnique({
      where: { id: jobId },
      select: { subscriberIds: true, topic: true },
    });
    for (const studentId of jobState?.subscriberIds ?? []) {
      emitContentGenerated(studentId, content.id, jobState?.topic ?? job.data.topic);
    }
  } catch (notifyErr) {
    logger.warn('ContentGenerationWorker: socket notify failed', {
      jobId,
      error: String(notifyErr),
    });
  }

  // Clean up partial cache after a short delay (keep for 10 minutes post-completion)
  await redis.expire(`content_gen:${jobId}:partial`, 600);

  void generationLogService.logGeneration({
    promptType: 'LESSON_GENERATION',
    promptVersion: 'unknown',
    requestVariables: {
      topic: job.data.topic,
      subject: job.data.subject,
      grade: job.data.grade,
      board: job.data.board,
      language: job.data.language ?? 'en',
    },
    responseText: fullContent,
    modelName: 'gpt-4o-mini',
    success: true,
    retryCount: Math.max(0, (job.attemptsMade ?? 1) - 1),
    userId: requesterId,
    contentId: content.id,
    jobId,
  });

  logger.info('ContentGenerationWorker: job completed', { jobId, contentId: content.id });
}

// ── Worker factory (lazy-init, no module-scope side-effects) ─────────────────

let _worker: Worker | null = null;

export function getContentGenerationWorker(): Worker {
  if (!_worker) {
    _worker = new Worker<ContentGenerationJobData>(
      CONTENT_GENERATION_QUEUE,
      processContentGenerationJob,
      {
        connection: getSharedConnection(),
        concurrency: 3,
        limiter: {
          max: 10,
          duration: 60_000, // 10 jobs per minute
        },
        lockDuration: 120_000, // 120-second timeout per job
      }
    );

    _worker.on('failed', async (job, err) => {
      if (!job) return;
      logger.error('ContentGenerationWorker: job failed', { jobId: job.data.jobId, error: err });

      void generationLogService.logGeneration({
        promptType: 'LESSON_GENERATION',
        promptVersion: 'unknown',
        requestVariables: {
          topic: job.data.topic,
          subject: job.data.subject,
          grade: job.data.grade,
          board: job.data.board,
          language: job.data.language ?? 'en',
        },
        modelName: 'gpt-4o-mini',
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
        retryCount: Math.max(0, (job.attemptsMade ?? 1) - 1),
        userId: job.data.requesterId,
        jobId: job.data.jobId,
      });

      // On final failure (no more retries), update job status
      if ((job.attemptsMade ?? 0) >= (job.opts.attempts ?? 3)) {
        await prisma.generationJob
          .update({
            where: { id: job.data.jobId },
            data: {
              status: 'FAILED',
              errorMessage: err instanceof Error ? err.message : String(err),
            },
          })
          .catch((updateErr: unknown) =>
            logger.error('Failed to update GenerationJob status', { error: updateErr })
          );

        // Publish error event to SSE subscribers
        const redis = getRedis();
        if (redis) {
          await redis
            .publish(
              `content_gen:${job.data.jobId}:updates`,
              JSON.stringify({
                type: 'error',
                message: 'Content generation failed. We will try again.',
              })
            )
            .catch(() => {});
        }
      }
    });

    _worker.on('error', (err) => {
      logger.error('ContentGenerationWorker: worker error', { error: err });
    });
  }
  return _worker;
}
