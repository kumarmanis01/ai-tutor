import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';
import { checkProfanity } from '@/lib/guardrails';
import { parse as parseAcceptLanguage } from 'accept-language-parser';

type Req = { text?: string; language?: string; images?: string[]; consentToShare?: boolean; conversationId?: string; subject?: string };

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
      // non-fatal
      logger.error('logApiUsage failed for /api/ask', { className: 'api.ask', methodName: 'POST', error: e });
    }

    const body: Req = await req.json().catch(() => ({}));
    const text = body.text;
    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    const subject = (body.subject && typeof body.subject === 'string' ? body.subject : 'general');
    // Conversation threading: accept or generate a conversationId and persist via Conversation + Chat relation
    let conversationId: string = body.conversationId || '';
    try {
      if (!conversationId) {
        conversationId = `conv_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
      }
    } catch {
      conversationId = `conv_${Math.random().toString(36).slice(2)}`;
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    if (!OPENAI_API_KEY) return NextResponse.json({ error: 'Server missing OPENAI_API_KEY' }, { status: 500 });

    // Profanity guard
    try {
      if (checkProfanity(text)) return NextResponse.json({ error: 'profanity_detected' }, { status: 400 });
    } catch (e) {
      // if guard check fails for any reason, continue but log
      logger.error('profanity guard error', { className: 'api.ask', methodName: 'POST', error: e });
    }

    // Optional session: if present, we'll persist transcripts and can apply limits later
    let sessionUserId: string | undefined;
    try {
      const session = await getServerSessionForHandlers();
      if (session && (session as any).user && (session as any).user.id) {
        sessionUserId = (session as any).user.id as string;
        // persist user's question (best-effort)
        try {
          // Auto-reconcile legacy conversations saved under wrong subject:
          // If this conversation has existing rows with a different subject and none with the provided subject,
          // reassign them to the provided subject once.
          try {
            const hasWrongSubject = await prisma.chat.findFirst({ where: { userId: sessionUserId, conversationId, NOT: { subject } } });
            const hasCorrectSubject = await prisma.chat.findFirst({ where: { userId: sessionUserId, conversationId, subject } });
            if (hasWrongSubject && !hasCorrectSubject) {
              await prisma.chat.updateMany({ where: { userId: sessionUserId, conversationId }, data: { subject } });
            }
          } catch {}
          // Ensure Conversation exists for this user + conversationId
          try {
            await prisma.conversation.upsert({
              where: { id: conversationId },
              update: {},
              create: { id: conversationId, userId: sessionUserId },
            });
          } catch {}
          // Persist user message linked to Conversation; also set legacy subject for back-compat
          await prisma.chat.create({ data: { userId: sessionUserId, role: 'user', content: text, conversationId, subject } });
          } catch (e) {
          // don't block on DB write
          logger.error('Failed to persist user question for /api/ask', { className: 'api.ask', methodName: 'POST', error: e });
        }
      }
    } catch (e) {
      // ignore session errors
      logger.error('session check failed for /api/ask', { className: 'api.ask', methodName: 'POST', error: e });
    }

    // Language normalization: prefer explicit language, else normalize Accept-Language header
    function resolveBcp47(header?: string, hint?: string) {
      // If client provided an explicit language hint, use it
      if (hint && typeof hint === 'string' && hint !== 'auto') return hint;
      if (!header) return undefined;
      try {
        const parts = parseAcceptLanguage(header);
        if (!parts || parts.length === 0) return undefined;
        const p = parts[0];
        // prefer region if available (e.g., mr-IN), else return language code
        return p.region ? `${p.code}-${p.region}` : p.code;
      } catch (e) {
        logger.error('Accept-Language parse error', { className: 'api.ask', methodName: 'POST', error: e });
        return undefined;
      }
    }

    const clientLangHint = body.language;
    const resolvedLang = resolveBcp47(req.headers.get('accept-language') ?? undefined, clientLangHint as any);

    // Append a hint to the system prompt to prefer the resolved language if available
    const systemPromptWithLang = resolvedLang ? `${SYSTEM_PROMPT}\nPreferred-Language: ${resolvedLang}` : SYSTEM_PROMPT;

    const imagesFromClient: string[] = (body as any).images ?? [];
    const consentToShare: boolean = Boolean((body as any).consentToShare || (body as any).consent);

    // Try to obtain captions for any provided images via our internal caption endpoint.
    // This is best-effort: captions may be null if no caption service is configured.
    let captions: (string | null)[] = [];
    if (imagesFromClient.length > 0) {
      try {
        const proto = req.headers.get('x-forwarded-proto') ?? 'http';
        const host = req.headers.get('host') ?? 'localhost:3000';
        const origin = `${proto}://${host}`;

        const captionPromises = imagesFromClient.map((url) =>
          fetch(`${origin}/api/image-caption`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, consent: consentToShare }),
          })
            .then((r) => (r.ok ? r.json().catch(() => ({ caption: null })) : { caption: null }))
            .then((j) => (j && typeof j.caption === 'string' ? j.caption : null))
            .catch(() => null),
        );

        captions = await Promise.all(captionPromises);
      } catch (e) {
        logger.error('Failed to fetch image captions', { className: 'api.ask', methodName: 'POST', error: e });
        captions = imagesFromClient.map(() => null);
      }
    }

    // If images were provided, include a short note in the system prompt so the model knows images exist.
    // Include available captions to give the model usable visual context.
    // Build multimodal user content: include text plus image_url parts when consented
    const userContentParts: any[] = [{ type: 'text', text }];
    if (consentToShare && imagesFromClient && imagesFromClient.length > 0) {
      for (let i = 0; i < imagesFromClient.length; i++) {
        const url = imagesFromClient[i];
        if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
          userContentParts.push({
            type: 'image_url',
            image_url: { url },
          });
          // If we have a caption, add it as an additional text hint next to the image
          const cap = captions[i];
          if (cap && typeof cap === 'string') {
            userContentParts.push({ type: 'text', text: `(caption ${i + 1}): ${cap}` });
          }
        }
      }
    }

    // Build conversation history for better context if a session exists
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
      logger.error('Failed to load conversation history', { className: 'api.ask', methodName: 'POST', error: e });
    }

    const messagesToSend = [
      { role: 'system', content: systemPromptWithLang },
      ...priorMessages,
      { role: 'user', content: userContentParts },
    ];

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model, messages: messagesToSend, temperature: 0.35, max_tokens: 800 }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return NextResponse.json({ error: `OpenAI error: ${resp.status} ${txt}` }, { status: 500 });
    }

    const data = await resp.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: 'Invalid response from LLM' }, { status: 500 });

    // Try to parse JSON from model output
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = String(content).match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          // fall through
        }
      }
    }

    if (!parsed) {
      // As a fallback, return a user-friendly message instead of raw JSON
      const fallbackMsg =
        'Sorry, I could not understand the AI response. Please try rephrasing your question or ask again.';
      // Persist assistant reply if session present (best-effort)
      if (sessionUserId) {
        try {
          await prisma.chat.create({ data: { userId: sessionUserId, role: 'assistant', content: fallbackMsg, conversationId, subject } });
        } catch (e) {
          logger.error('Failed to persist assistant reply for /api/ask (fallback)', { className: 'api.ask', methodName: 'POST', error: e });
        }
      }
      return NextResponse.json({ language: undefined, answer: fallbackMsg });
    }

    const language = parsed.language || parsed.lang || undefined;
    const answer = parsed.answer || parsed.text || '';
    let suggestions: string[] = [];
    try {
      if (Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions.filter((s: any) => typeof s === 'string').slice(0, 5);
      }
    } catch {
      suggestions = [];
    }

    // Persist assistant reply when available
    if (sessionUserId) {
      try {
        await prisma.chat.create({ data: { userId: sessionUserId, role: 'assistant', content: answer, conversationId, subject } });
      } catch (e) {
        logger.error('Failed to persist assistant reply for /api/ask', { className: 'api.ask', methodName: 'POST', error: e });
      }
    }

    return NextResponse.json({ language, answer, suggestions, conversationId });
  } catch (err: any) {
    logger.error('/api/ask error', { className: 'api.ask', methodName: 'POST', error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
