import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';
import { checkProfanity } from '@/lib/guardrails';
import { parse as parseAcceptLanguage } from 'accept-language-parser';
import crypto from 'crypto';

type Req = {
  text?: string;
  language?: string;
  images?: string[];
  consentToShare?: boolean;
  conversationId?: string;
  subject?: string;
};

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

export async function POST(req: Request) {
  try {
    // Log API usage for analytics
    try {
      await logApiUsage('/api/ask', 'POST');
    } catch (e) {
      logger.error('logApiUsage failed for /api/ask', {
        className: 'api.ask',
        methodName: 'POST',
        error: e,
      });
    }

    const body: Req = await req.json().catch(() => ({}) as Req);
    const text = body.text;
    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    const subject = body.subject && typeof body.subject === 'string' ? body.subject : 'general';

    // Conversation threading: accept or generate a conversationId and persist via Conversation + Chat relation
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
      if (checkProfanity(text))
        return NextResponse.json({ error: 'profanity_detected' }, { status: 400 });
    } catch (e) {
      logger.error('profanity guard error', { className: 'api.ask', methodName: 'POST', error: e });
    }

    // Optional session: if present, we'll persist transcripts and can apply limits later
    let sessionUserId: string | undefined;
    try {
      const session = await getServerSessionForHandlers();
      if (session && (session as any).user && (session as any).user.id) {
        sessionUserId = (session as any).user.id as string;
        try {
          await prisma.conversation.upsert({
            where: { id: conversationId },
            update: {},
            create: { id: conversationId, userId: sessionUserId },
          });
          await prisma.chat
            .create({
              data: { userId: sessionUserId, role: 'user', content: text, conversationId, subject },
            })
            .catch((e) => {
              logger.warn('Failed to persist user question for /api/ask', {
                className: 'api.ask',
                methodName: 'POST',
                error: e,
              });
            });
        } catch (e) {
          logger.warn('Failed to persist session conversation', {
            className: 'api.ask',
            methodName: 'POST',
            error: e,
          });
        }
      }
    } catch (e) {
      logger.error('session check failed for /api/ask', {
        className: 'api.ask',
        methodName: 'POST',
        error: e,
      });
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
        logger.error('Accept-Language parse error', {
          className: 'api.ask',
          methodName: 'POST',
          error: e,
        });
        return undefined;
      }
    }

    const clientLangHint = body.language;
    const resolvedLang = resolveBcp47(
      req.headers.get('accept-language') ?? undefined,
      clientLangHint as any
    );

    const systemPromptWithLang = resolvedLang
      ? `${SYSTEM_PROMPT}\nPreferred-Language: ${resolvedLang}`
      : SYSTEM_PROMPT;

    // Build conversation history for context if available
    const priorMessages: { role: 'system' | 'user' | 'assistant'; content: any }[] = [];
    try {
      if (sessionUserId && conversationId) {
        const history = await prisma.chat.findMany({
          where: { userId: sessionUserId, conversationId },
          orderBy: { createdAt: 'asc' },
          take: 12,
        });
        for (const h of history) {
          const role = h.role === 'assistant' ? 'assistant' : 'user';
          priorMessages.push({ role, content: h.content });
        }
      }
    } catch (e) {
      logger.error('Failed to load conversation history', {
        className: 'api.ask',
        methodName: 'POST',
        error: e,
      });
    }

    const messagesToSend = [
      { role: 'system', content: systemPromptWithLang },
      ...priorMessages,
      { role: 'user', content: text },
    ];

    // Enqueue AI request to worker queue
    try {
      const { getAIRequestQueue } = await import('@/queues/aiQueue');
      const q = getAIRequestQueue();
      const job = await q.add('AI_ASK', {
        type: 'ASK',
        payload: {
          messages: messagesToSend,
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          meta: { subject, conversationId, language: resolvedLang, sessionUserId },
        },
      });
      return NextResponse.json(
        { status: 'queued', jobId: job.id, conversationId },
        { status: 202 }
      );
    } catch (e) {
      logger.error('Failed to enqueue AI request', {
        className: 'api.ask',
        methodName: 'POST',
        error: String(e),
      });
      return NextResponse.json({ error: 'Could not enqueue AI request' }, { status: 500 });
    }
  } catch (err: any) {
    logger.error('/api/ask error', { className: 'api.ask', methodName: 'POST', error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
