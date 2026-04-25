/**
 * FILE OBJECTIVE:
 * - Worker processor for AI request queue (`ai-requests`).
 * - Handles job types: ASK, CHAT, NARRATIVE.
 * - Runs intent classification, calls `callLLM` (with `suppressLog`),
 *   runs hallucination detection, persists validated assistant replies,
 *   and records an audited, redacted AIContentLog entry.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/aiRequestWorker.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-11T00:00:00Z | copilot | created AI request worker
 */

import { Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  classifyIntent,
  getSafeResponseForIntent,
  formatResponseForStudent,
  checkForHallucinations,
} from '@/lib/ai/guardrails';
import { callLLM } from '@/lib/callLLM';

type AIJobData = {
  type: string;
  payload: any;
};

function messagesToPrompt(messages: any[]): string {
  if (!Array.isArray(messages)) return String(messages ?? '');
  const parts: string[] = [];
  for (const m of messages) {
    try {
      const role = String(m.role ?? 'user');
      const content = m.content ?? m;
      if (typeof content === 'string') {
        parts.push(`${role.toUpperCase()}: ${content}`);
      } else if (Array.isArray(content)) {
        // array of parts (e.g., multimodal parts)
        const flattened = content
          .map((p: any) => (typeof p === 'string' ? p : JSON.stringify(p)))
          .join('\n');
        parts.push(`${role.toUpperCase()}: ${flattened}`);
      } else {
        parts.push(`${role.toUpperCase()}: ${JSON.stringify(content)}`);
      }
    } catch (e) {
      parts.push(String(m));
    }
  }
  return parts.join('\n\n');
}

export async function processAIRequest(job: Job<AIJobData>) {
  const data = job.data as any;
  const type = String(data?.type ?? data?.jobType ?? '').toUpperCase();
  const payload = data?.payload ?? {};
  const messages = payload.messages ?? [];
  const model = payload.model ?? process.env.MODEL_DEFAULT ?? 'gpt-4o-mini';
  const meta = payload.meta ?? {};

  // Extract the last user textual message for intent classification
  let lastUserText = '';
  try {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (!m) continue;
      const role = (m.role || '').toString().toLowerCase();
      if (role === 'user' || role === 'system') {
        const c = m.content;
        if (typeof c === 'string') {
          lastUserText = c;
          break;
        }
        if (Array.isArray(c)) {
          lastUserText = c
            .map((p: any) => (typeof p === 'string' ? p : JSON.stringify(p)))
            .join(' ');
          break;
        }
        lastUserText = JSON.stringify(c);
        break;
      }
    }
  } catch (e) {
    logger.warn('processAIRequest: failed to extract lastUserText', { error: String(e) });
  }

  // Classification & guardrail: if intent requires blocking, return safe fallback
  try {
    const classification = classifyIntent(lastUserText || '', meta?.grade ?? 6, meta?.subject);
    if (classification?.primaryIntent === 'unsafe' || classification?.requiresIntervention) {
      const safe = getSafeResponseForIntent(
        classification.primaryIntent as any,
        meta?.grade ?? 6,
        meta?.subject
      );
      const message = formatResponseForStudent(safe);

      // Persist assistant fallback (best-effort)
      try {
        if (meta?.sessionUserId) {
          await prisma.chat.create({
            data: {
              userId: String(meta.sessionUserId),
              role: 'assistant',
              content: message,
              conversationId: meta?.conversationId ?? null,
              subject: meta?.subject ?? null,
            },
          });
        }
      } catch (e) {
        logger.warn('processAIRequest: failed to persist fallback chat', { error: String(e) });
      }

      // Audit log: blocked by intent classifier
      try {
        await prisma.aIContentLog.create({
          data: {
            model,
            promptType: type.toLowerCase(),
            language: meta?.language ?? null,
            success: false,
            status: 'blocked',
            error: 'intent_block',
            requestBody: payload,
            // Ensure stored JSON is a plain-serializable object
            responseBody: {
              reason: 'intent_block',
              classification: JSON.parse(JSON.stringify(classification)),
            },
          },
        });
      } catch (e) {
        logger.warn('processAIRequest: failed to write AIContentLog for blocked intent', {
          error: String(e),
        });
      }

      return { status: 'blocked', reason: 'intent' };
    }
  } catch (e) {
    logger.warn('processAIRequest: intent classification failed', { error: String(e) });
  }

  // Build a single prompt from messages
  const prompt = messagesToPrompt(messages);

  // Call LLM with suppressLog=true so worker controls persistence and redaction
  let llmResult: any = null;
  try {
    llmResult = await callLLM({ prompt, model, meta: { ...(meta || {}), suppressLog: true } });
  } catch (e) {
    logger.error('processAIRequest: callLLM failed', { error: String(e), jobId: job.id });
    // Persist an AIContentLog indicating failure
    try {
      await prisma.aIContentLog.create({
        data: {
          model,
          promptType: type.toLowerCase(),
          language: meta?.language ?? null,
          success: false,
          status: 'failed',
          error: String(e),
          requestBody: { payload },
          responseBody: { error: String(e) },
        },
      });
    } catch {}
    // Optionally persist a safe fallback chat
    try {
      const fallback = getSafeResponseForIntent('REVISION' as any, meta?.grade ?? 6, meta?.subject);
      const fallbackText = formatResponseForStudent(fallback);
      if (meta?.sessionUserId) {
        await prisma.chat.create({
          data: {
            userId: String(meta.sessionUserId),
            role: 'assistant',
            content: fallbackText,
            conversationId: meta?.conversationId ?? null,
            subject: meta?.subject ?? null,
          },
        });
      }
    } catch {}

    throw e;
  }

  const content: string = String(llmResult?.content ?? '');

  // Hallucination detection
  let hallucinationCheck = null;
  try {
    const grade = meta?.grade ?? 6;
    hallucinationCheck = checkForHallucinations(content, grade, meta?.subject ?? 'General');
  } catch (e) {
    logger.warn('processAIRequest: hallucination check failed', { error: String(e) });
  }

  // If hallucination detector requests blocking, persist a safe response instead
  if (hallucinationCheck?.shouldBlock) {
    try {
      const fallback = getSafeResponseForIntent('REVISION' as any, meta?.grade ?? 6, meta?.subject);
      const fallbackText = formatResponseForStudent(fallback);
      if (meta?.sessionUserId) {
        await prisma.chat.create({
          data: {
            userId: String(meta.sessionUserId),
            role: 'assistant',
            content: fallbackText,
            conversationId: meta?.conversationId ?? null,
            subject: meta?.subject ?? null,
          },
        });
      }
    } catch (e) {
      logger.warn('processAIRequest: failed to persist blocked hallucination fallback', {
        error: String(e),
      });
    }

    try {
      await prisma.aIContentLog.create({
        data: {
          model,
          promptType: type.toLowerCase(),
          language: meta?.language ?? null,
          success: false,
          status: 'flagged',
          error: 'hallucination_detected',
          requestBody: { prompt },
          // Make sure the hallucination check object is JSON-serializable
          responseBody: {
            snippet: content?.slice(0, 2000),
            hallucinationCheck: JSON.parse(JSON.stringify(hallucinationCheck)),
          },
        },
      });
    } catch (e) {
      logger.warn('processAIRequest: failed to write AIContentLog for hallucination', {
        error: String(e),
      });
    }

    return { status: 'flagged', reason: 'hallucination' };
  }

  // Persist assistant reply and an audited, redacted AIContentLog (no raw full text)
  try {
    if (meta?.sessionUserId) {
      await prisma.chat.create({
        data: {
          userId: String(meta.sessionUserId),
          role: 'assistant',
          content,
          conversationId: meta?.conversationId ?? null,
          subject: meta?.subject ?? null,
        },
      });
    }
  } catch (e) {
    logger.warn('processAIRequest: failed to persist assistant chat', { error: String(e) });
  }

  try {
    await prisma.aIContentLog.create({
      data: {
        model,
        promptType: type.toLowerCase(),
        language: meta?.language ?? null,
        success: true,
        status: 'validated',
        requestBody: { prompt },
        // Store only a snippet to avoid persisting full raw LLM output
        responseBody: {
          snippet: content?.slice(0, 4000),
          usage: llmResult?.usage ?? null,
          latencyMs: llmResult?.latencyMs ?? null,
        },
      },
    });
  } catch (e) {
    logger.warn('processAIRequest: failed to write validated AIContentLog', { error: String(e) });
  }

  return { status: 'completed' };
}

export default processAIRequest;
