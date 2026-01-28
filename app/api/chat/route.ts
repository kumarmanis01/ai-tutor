import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
/**
 * POST /api/chat
 * Body: { message: string, subject?: string }
 *
 * Requirements:
 * - User must be authenticated to ask questions (browsing allowed otherwise)
 * - Free users: up to 3 questions/day
 * - Premium users: unlimited
 * - Saves chat to prisma.chat
 * - Logs API usage to prisma.apiUsage
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { subjectPrompts } from '@/lib/subjectEngines';
import { isPremiumUser } from '@/lib/subscription';
import { checkProfanity } from '@/lib/guardrails';
import { SessionUser } from '@/lib/types';
import { logApiUsage } from '@/utils/logApiUsage';
import { parse as parseAcceptLanguage } from 'accept-language-parser';

export async function POST(req: Request) {
  logApiUsage('/api/chat', 'POST');
  try {
    const session = await getServerSessionForHandlers();
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const sessionUser = session.user as SessionUser;

    // Require auth for asking questions
    if (!sessionUser || !sessionUser.id) {
      return NextResponse.json({ error: 'login_required' }, { status: 401 });
    }

    const body = await req.json();
    const { message, subject = 'general', lang = 'auto' } = body;

    function resolveAcceptLanguage(header?: string) {
      if (!header) return 'English';
      try {
        const parsed = parseAcceptLanguage(header);
        if (!parsed || parsed.length === 0) return 'English';
        const primary = (parsed[0].code || 'en').toLowerCase();
        if (primary.startsWith('hi')) return 'Hindi';
        if (primary.startsWith('ta')) return 'Tamil';
        if (primary.startsWith('bn')) return 'Bengali';
        if (primary.startsWith('fr')) return 'French';
        if (primary.startsWith('es')) return 'Spanish';
        if (primary.startsWith('en')) return 'English';
        return 'English';
      } catch (e) {
        logger.error('Accept-Language parse error', { className: 'api.chat', methodName: 'POST', error: e });
        return 'English';
      }
    }

    // Resolve language: if client sent 'auto', infer from Accept-Language header
    const resolvedLang =
      lang === 'auto'
        ? resolveAcceptLanguage(req.headers.get('accept-language') ?? undefined)
        : typeof lang === 'string'
          ? lang
          : 'English';

    // Log which subject was requested for usage metrics
    try {
      await logApiUsage('/api/chat', `SUBJECT_${subject}`);
    } catch (e) {
      logger.error('Failed to log subject usage', { className: 'api.chat', methodName: 'POST', error: e });
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message_required' }, { status: 400 });
    }

    // Profanity guard
    if (checkProfanity(message)) {
      return NextResponse.json({ error: 'profanity_detected' }, { status: 400 });
    }

    const userId = sessionUser.id as string;

    // Check subscription active via helper
    const premium = await isPremiumUser(userId);

    // If not premium, perform lazy UTC reset + atomic decrement on user's free-questions
    if (!premium) {
      const DAILY_FREE_LIMIT = Number(process.env.NEXT_PUBLIC_DAILY_FREE_LIMIT ?? 3);

      // Atomic decrement using `todaysFreeQuestionsCount` only.
      const txResult = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) return { notFound: true } as const;

        if ((user.todaysFreeQuestionsCount ?? DAILY_FREE_LIMIT) <= 0) {
          return { limitReached: true } as const;
        }

        const updated = await tx.user.update({
          where: { id: userId },
          data: { todaysFreeQuestionsCount: { decrement: 1 } },
        });

        return { updated } as const;
      });

      if ('notFound' in txResult) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      if ('limitReached' in txResult)
        return NextResponse.json({ error: 'free_limit_reached', message: 'Free limit reached.' }, { status: 403 });
    }

    // Save user's question
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      return NextResponse.json({ error: 'Connection to Your AI Model broken' }, { status: 500 });
    }
    // Persist the user's question before sending to AI
    await prisma.chat.create({ data: { userId, role: 'user', content: message, subject } });

    // Prepare messages for AI - prefer curated subject prompts when available
    const basePrompt = subjectPrompts[subject] ?? `You are a helpful ${subject} tutor.`;
    // Ask the model to return a structured JSON object with a markdown answer
    const systemPrompt = `${basePrompt} Please respond in ${resolvedLang}.
  Return ONLY valid JSON with a key named "answerMarkdown" whose value is a markdown-formatted string containing the assistant's reply (use headers, lists, and examples as appropriate). Also include an optional "language" field with the BCP-47 language code. Example:
  {"language":"en","answerMarkdown":"# Short summary\nYour content here..."}
  Do not return any other text outside the JSON object.`;
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];

    const payload = {
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.6,
      max_tokens: 800,
    };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      logger.error('OpenAI API error', { className: 'api.chat', methodName: 'POST', body: data });
      return NextResponse.json(
        {
          error: 'ai_service_error',
          message: data.error?.message || 'AI service error',
        },
        { status: 500 },
      );
    }

    const aiRaw = data.choices?.[0]?.message?.content?.trim();
    if (!aiRaw) {
      return NextResponse.json(
        { error: 'ai_no_response', message: 'AI did not return a response' },
        { status: 500 },
      );
    }

    // Attempt to parse JSON to get answerMarkdown; fall back to raw text
    let answerMarkdown = aiRaw as string;
    try {
      const parsed = JSON.parse(String(aiRaw));
      if (parsed && typeof parsed.answerMarkdown === 'string') {
        answerMarkdown = parsed.answerMarkdown;
      }
    } catch {
      // try to extract a JSON object from the text
      const m = String(aiRaw).match(/\{[\s\S]*\}/);
      if (m) {
        try {
          const parsed = JSON.parse(m[0]);
          if (parsed && typeof parsed.answerMarkdown === 'string') answerMarkdown = parsed.answerMarkdown;
        } catch {}
      }
    }

    // Check if user exists before saving chat
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      logger.error('User not found', { className: 'api.chat', methodName: 'POST', userId });
      return NextResponse.json({ error: 'User not found' }, { status: 400 });
    }

    // Save assistant reply (store markdown or raw text)
    await prisma.chat.create({
      data: {
        userId,
        role: 'assistant',
        content: answerMarkdown,
        subject,
      },
    });

    // Generate lightweight follow-up suggestions (best-effort)
    let suggestions: string[] = [];
    try {
      const suggestPromptSystem = `You are a concise tutor. Given a user's question and an assistant answer, return ONLY a JSON array of 2-5 short follow-up suggestions (each 2-10 words) that the user can click to continue the conversation. Return the suggestions in the same language as the assistant answer.`;
      const suggestPromptUser = `User question:\n${message}\n\nAssistant answer:\n${aiRaw}\n\nReturn a JSON array of short suggestion strings.`;

      const sres = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: suggestPromptSystem },
            { role: 'user', content: suggestPromptUser },
          ],
          temperature: 0.5,
          max_tokens: 120,
        }),
      });

      if (sres.ok) {
        const sdata = await sres.json().catch(() => null);
        const scontent = sdata?.choices?.[0]?.message?.content;
        if (scontent) {
          try {
            const parsed = JSON.parse(scontent);
            if (Array.isArray(parsed)) suggestions = parsed.filter((s: any) => typeof s === 'string').slice(0, 5);
          } catch {
            // try to extract a JSON array from text
            const m = String(scontent).match(/\[[\s\S]*\]/);
            if (m) {
              try {
                const parsed = JSON.parse(m[0]);
                if (Array.isArray(parsed)) suggestions = parsed.filter((s: any) => typeof s === 'string').slice(0, 5);
              } catch {}
            }
          }
        }
      }
    } catch (e) {
      logger.error('suggestions generation failed', { className: 'api.chat', methodName: 'POST', error: e });
    }

    return NextResponse.json({ reply: answerMarkdown, suggestions });
  } catch (err) {
    logger.error('chat route error', { className: 'api.chat', methodName: 'POST', error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
