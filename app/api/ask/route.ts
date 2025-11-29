import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logApiUsage } from '@/utils/logApiUsage';
import { checkProfanity } from '@/lib/guardrails';
import { parse as parseAcceptLanguage } from 'accept-language-parser';

type Req = { text?: string; language?: string; images?: string[]; consentToShare?: boolean };

const SYSTEM_PROMPT = `You are an AI assistant. Detect the user's language automatically based on the user's message.
Always respond in the same language the user used.
Return only valid JSON, with TWO keys:
{
  "language": "<BCP-47 language code like 'hi' or 'mr-IN' or 'en'>",
  "answer": "<the assistant's reply in the user's language>"
}
Do not add any other text, explanation, or commentary outside the JSON object.
`;

export async function POST(req: Request) {
  try {
    // Log API usage for analytics
    try {
      await logApiUsage('/api/ask', 'POST');
    } catch (e) {
      // non-fatal
      console.error('logApiUsage failed for /api/ask', e);
    }

    const body: Req = await req.json().catch(() => ({}));
    const text = body.text;
    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    if (!OPENAI_API_KEY) return NextResponse.json({ error: 'Server missing OPENAI_API_KEY' }, { status: 500 });

    // Profanity guard
    try {
      if (checkProfanity(text)) return NextResponse.json({ error: 'profanity_detected' }, { status: 400 });
    } catch (e) {
      // if guard check fails for any reason, continue but log
      console.error('profanity guard error', e);
    }

    // Optional session: if present, we'll persist transcripts and can apply limits later
    let sessionUserId: string | undefined;
    try {
      const session = await getServerSession(authOptions as any);
      if (session && (session as any).user && (session as any).user.id) {
        sessionUserId = (session as any).user.id as string;
        // persist user's question (best-effort)
        try {
          await prisma.chat.create({ data: { userId: sessionUserId, role: 'user', content: text, subject: 'general' } });
        } catch (e) {
          // don't block on DB write
          console.error('Failed to persist user question for /api/ask', e);
        }
      }
    } catch (e) {
      // ignore session errors
      console.error('session check failed for /api/ask', e);
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
        console.error('Accept-Language parse error', e);
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
        console.error('Failed to fetch image captions', e);
        captions = imagesFromClient.map(() => null);
      }
    }

    // If images were provided, include a short note in the system prompt so the model knows images exist.
    // Include available captions to give the model usable visual context.
    const imagesNote =
      imagesFromClient && imagesFromClient.length > 0
        ? `\nAttached images:\n${imagesFromClient
            .map((u, i) => `${i + 1}. ${u}${captions[i] ? ` — caption: ${captions[i]}` : ''}`)
            .join('\n')}\n\nIf you cannot access these URLs, ask the user for a brief description of the image(s).`
        : '';

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPromptWithLang + imagesNote },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }),
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
      // As a fallback, return language as undefined and answer as raw content
      // Persist assistant reply if session present (best-effort)
      if (sessionUserId) {
        try {
          await prisma.chat.create({ data: { userId: sessionUserId, role: 'assistant', content: String(content), subject: 'general' } });
        } catch (e) {
          console.error('Failed to persist assistant reply for /api/ask (fallback)', e);
        }
      }
      return NextResponse.json({ language: undefined, answer: String(content) });
    }

    const language = parsed.language || parsed.lang || undefined;
    const answer = parsed.answer || parsed.text || '';

    // Persist assistant reply when available
    if (sessionUserId) {
      try {
        await prisma.chat.create({ data: { userId: sessionUserId, role: 'assistant', content: answer, subject: 'general' } });
      } catch (e) {
        console.error('Failed to persist assistant reply for /api/ask', e);
      }
    }

    return NextResponse.json({ language, answer });
  } catch (err: any) {
    console.error('/api/ask error', err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
