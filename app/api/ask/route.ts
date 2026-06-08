/**
 * FILE OBJECTIVE:
 * - POST /api/ask: accepts a student question, streams the AI response via SSE,
 *   and persists conversation turns for authenticated sessions.
 *
 * EDIT LOG:
 * - 2026-06-08T13:00:00Z | claude | integrate generationCache; serve cached replies as streamed tokens when all context fields present and no conversationId
 * - 2026-06-08T12:00:00Z | claude | convert buffered JSON response to SSE streaming; add 401 auth guard
 */

import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';
import { checkProfanity } from '@/lib/guardrails';
import { parse as parseAcceptLanguage } from 'accept-language-parser';
import crypto from 'crypto';
import OpenAI from 'openai';
import { getGeneratedContent, setGeneratedContent, buildGenerationCacheKey } from '@/lib/cache/generationCache';
import type { GenerationCacheKey } from '@/lib/cache/generationCache';

type Req = { text?: string; language?: string; images?: string[]; consentToShare?: boolean; conversationId?: string; subject?: string; board?: string; grade?: string; topicSlug?: string; contentType?: string; difficulty?: string };

const SYSTEM_PROMPT = `You are an AI assistant. Detect the user's language automatically based on the user's message.
Always respond in the same language the user used.
Return only valid JSON. The object MUST contain these keys:
{
  "language": "<BCP-47 language code like 'hi' or 'mr-IN' or 'en'>",
  "answer": "<the assistant's reply in the user's language>",
  // optional: an array of 2-5 short follow-up suggestions the user can click to continue the conversation
  "suggestions": ["<short suggestion 1>", "<short suggestion 2>"]
}
Do not add any other text, explanation, or commentary outside the JSON object. If you cannot provide suggestions, return an empty array for 'suggestions'.
`;

// Lazy singleton -- never instantiated per-request
let _openaiClient: OpenAI | null = null;
function getStreamingClient(): OpenAI {
  if (!_openaiClient) {
    _openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openaiClient;
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'X-Accel-Buffering': 'no',
} as const;

function sseEvent(payload: object): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

const SSE_DONE = 'data: [DONE]\n\n';

export async function POST(req: Request) {
  // Log API usage for analytics
  try {
    await logApiUsage('/api/ask', 'POST');
  } catch (e) {
    logger.error('logApiUsage failed for /api/ask', { className: 'api.ask', methodName: 'POST', error: e });
  }

  // Auth guard -- session check before any business logic
  let sessionUserId: string;
  try {
    const session = await getServerSessionForHandlers();
    if (!session || !(session as any)?.user?.id) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    sessionUserId = (session as any).user.id as string;
  } catch (e) {
    logger.error('session check failed for /api/ask', { className: 'api.ask', methodName: 'POST', error: e });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Req;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const text = body.text;
  if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });
  const subject = (body.subject && typeof body.subject === 'string' ? body.subject : 'general');

  // Conversation threading
  let conversationId: string = body.conversationId || '';
  try {
    if (!conversationId) {
      conversationId = `conv_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    }
  } catch {
    conversationId = `conv_${Math.random().toString(36).slice(2)}`;
  }

  // Profanity guard
  try {
    if (checkProfanity(text)) return NextResponse.json({ error: 'profanity_detected' }, { status: 400 });
  } catch (e) {
    logger.error('profanity guard error', { className: 'api.ask', methodName: 'POST', error: e });
  }

  // Persist conversation and user turn
  try {
    await prisma.conversation.upsert({ where: { id: conversationId }, update: {}, create: { id: conversationId, userId: sessionUserId } });
    await prisma.chat.create({ data: { userId: sessionUserId, role: 'user', content: text, conversationId, subject } }).catch((e: unknown) => {
      logger.warn('Failed to persist user question for /api/ask', { className: 'api.ask', methodName: 'POST', error: e });
    });
  } catch (e) {
    logger.warn('Failed to persist session conversation', { className: 'api.ask', methodName: 'POST', error: e });
  }

  // Language normalization
  function resolveBcp47(header?: string, hint?: string) {
    if (hint && typeof hint === 'string' && hint !== 'auto') return hint;
    if (!header) return undefined;
    try {
      const parts = parseAcceptLanguage(header);
      if (!parts || parts.length === 0) return undefined;
      const p = parts[0];
      return p.region ? `${p.code}-${p.region}` : p.code;
    } catch (e) {
      logger.error('Accept-Language parse error', { className: 'api.ask', methodName: 'POST', error: e });
      return undefined;
    }
  }

  const clientLangHint = body.language;
  const resolvedLang = resolveBcp47(req.headers.get('accept-language') ?? undefined, clientLangHint as string | undefined);
  const systemPromptWithLang = resolvedLang ? `${SYSTEM_PROMPT}\nPreferred-Language: ${resolvedLang}` : SYSTEM_PROMPT;

  // Build conversation history for context
  const priorMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  try {
    const history = await prisma.chat.findMany({ where: { userId: sessionUserId, conversationId }, orderBy: { createdAt: 'asc' }, take: 12 });
    for (const h of history) {
      const role = h.role === 'assistant' ? 'assistant' : 'user';
      priorMessages.push({ role, content: h.content });
    }
  } catch (e) {
    logger.error('Failed to load conversation history', { className: 'api.ask', methodName: 'POST', error: e });
  }

  const messagesToSend: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPromptWithLang },
    ...priorMessages,
    { role: 'user', content: text },
  ];

  // Cache context: only cache first-turn questions that supply all 5 context fields
  const isFirstTurn = !body.conversationId;
  let cacheKey: GenerationCacheKey | null = null;
  if (isFirstTurn && body.board && body.grade && body.subject && body.topicSlug && body.contentType && body.difficulty) {
    cacheKey = {
      board: body.board,
      grade: body.grade,
      subject: body.subject,
      topicSlug: body.topicSlug,
      contentType: body.contentType,
      difficulty: body.difficulty,
    };
  }

  // Serve from cache when available -- stream the cached value with 5 ms token delay
  if (cacheKey) {
    const cached = await getGeneratedContent(cacheKey);
    if (cached) {
      const encoder = new TextEncoder();
      const cachedStream = new ReadableStream({
        async start(controller) {
          try {
            for (const char of cached) {
              controller.enqueue(encoder.encode(sseEvent({ token: char })));
              await new Promise<void>((resolve) => setTimeout(resolve, 5));
            }
            controller.enqueue(encoder.encode(SSE_DONE));
            controller.close();
            try {
              await prisma.chat.create({ data: { userId: sessionUserId, role: 'assistant', content: cached, conversationId, subject } });
            } catch (e) {
              logger.warn('Failed to persist cached assistant reply', { className: 'api.ask', methodName: 'POST', error: e });
            }
          } catch (e) {
            logger.error('/api/ask cached stream error', { className: 'api.ask', methodName: 'POST', error: String(e) });
            try { controller.enqueue(encoder.encode(sseEvent({ error: 'upstream_error' }))); controller.close(); } catch {}
          }
        },
      });
      return new Response(cachedStream, { headers: SSE_HEADERS });
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullReply = '';
      try {
        const openaiStream = await getStreamingClient().chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: messagesToSend,
          stream: true,
        });

        for await (const chunk of openaiStream) {
          const token = chunk.choices[0]?.delta?.content || '';
          if (token) {
            fullReply += token;
            controller.enqueue(encoder.encode(sseEvent({ token })));
          }
        }

        controller.enqueue(encoder.encode(SSE_DONE));
        controller.close();

        // Persist assistant reply and populate cache after stream completes
        try {
          await prisma.chat.create({ data: { userId: sessionUserId, role: 'assistant', content: fullReply, conversationId, subject } });
        } catch (e) {
          logger.warn('Failed to persist assistant reply for /api/ask', { className: 'api.ask', methodName: 'POST', error: e });
        }
        if (cacheKey && fullReply) {
          await setGeneratedContent(cacheKey, fullReply);
        }
      } catch (e) {
        logger.error('/api/ask stream error', { className: 'api.ask', methodName: 'POST', error: String(e) });
        try {
          controller.enqueue(encoder.encode(sseEvent({ error: 'upstream_error' })));
          controller.close();
        } catch {
          // controller may already be closed
        }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
