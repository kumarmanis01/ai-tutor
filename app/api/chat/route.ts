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
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { subjectPrompts } from '@/lib/subjectEngines';
import { isPremiumUser } from '@/lib/subscription';
import { checkProfanity } from '@/lib/guardrails';
import { SessionUser } from '@/lib/types';
import { logApiUsage } from '@/utils/logApiUsage';
import { parse as parseAcceptLanguage } from 'accept-language-parser';

export async function POST(req: Request) {
  logApiUsage('/api/chat', 'POST');
  try {
    const session = await getServerSession(authOptions);
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
        console.error('Accept-Language parse error', e);
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
      console.error('Failed to log subject usage', e);
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
    const systemPrompt = `${basePrompt} Please respond in ${resolvedLang}.`;
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
      console.error('OpenAI API error:', data);
      return NextResponse.json(
        {
          error: 'ai_service_error',
          message: data.error?.message || 'AI service error',
        },
        { status: 500 },
      );
    }

    const aiReply = data.choices?.[0]?.message?.content?.trim();
    if (!aiReply) {
      return NextResponse.json(
        { error: 'ai_no_response', message: 'AI did not return a response' },
        { status: 500 },
      );
    }

    // Check if user exists before saving chat
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.error('User not found:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 400 });
    }

    // Save assistant reply
    await prisma.chat.create({
      data: {
        userId,
        role: 'assistant',
        content: aiReply,
        subject,
      },
    });

    return NextResponse.json({ reply: aiReply });
  } catch (err) {
    console.error('chat route error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
