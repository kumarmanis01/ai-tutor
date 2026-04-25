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
    if (!session) return new Response('Unauthorized', { status: 401 });

    const sessionUser = session.user as SessionUser;
    if (!sessionUser || !sessionUser.id)
      return NextResponse.json({ error: 'login_required' }, { status: 401 });

    // Parse and validate request body
    const body = await req.json().catch(() => ({}));
    const message = typeof (body as any).message === 'string' ? (body as any).message.trim() : '';
    const subject = typeof (body as any).subject === 'string' ? (body as any).subject : 'general';

    // Resolve Accept-Language to a BCP-47-ish code (best-effort)
    let resolvedLang: string | undefined;
    try {
      const parts = parseAcceptLanguage(req.headers.get('accept-language') ?? '');
      if (parts && parts.length > 0) {
        const p = parts[0];
        resolvedLang = p.region ? `${p.code}-${p.region}` : p.code;
      }
    } catch (err) {
      logger.debug('Failed to parse Accept-Language header', {
        className: 'api.chat',
        error: String(err),
      });
      resolvedLang = undefined;
    }

    if (!message) return NextResponse.json({ error: 'message_required' }, { status: 400 });
    if (checkProfanity(message))
      return NextResponse.json({ error: 'profanity_detected' }, { status: 400 });

    const userId = sessionUser.id as string;
    const premium = await isPremiumUser(userId);
    if (!premium) {
      const DAILY_FREE_LIMIT = Number(process.env.NEXT_PUBLIC_DAILY_FREE_LIMIT ?? 3);
      const txResult = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) return { notFound: true } as const;
        if ((user.todaysFreeQuestionsCount ?? DAILY_FREE_LIMIT) <= 0)
          return { limitReached: true } as const;
        const updated = await tx.user.update({
          where: { id: userId },
          data: { todaysFreeQuestionsCount: { decrement: 1 } },
        });
        return { updated } as const;
      });
      if ('notFound' in txResult) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      if ('limitReached' in txResult)
        return NextResponse.json(
          { error: 'free_limit_reached', message: 'Free limit reached.' },
          { status: 403 }
        );
    }

    // Persist the user's question (best-effort) before handing off to worker
    await prisma.chat
      .create({ data: { userId, role: 'user', content: message, subject } })
      .catch((e) => {
        logger.warn('Failed to persist user chat', {
          className: 'api.chat',
          methodName: 'POST',
          error: e,
        });
      });

    // Prepare system prompt and messages
    const basePrompt = subjectPrompts[subject] ?? `You are a helpful ${subject} tutor.`;
    const systemPrompt = `${basePrompt} Please respond in ${resolvedLang ?? 'English'}.
Return ONLY valid JSON with a key named "answerMarkdown" whose value is a markdown-formatted string containing the assistant's reply.`;
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];

    // Enqueue job to AI worker
    try {
      const { getAIRequestQueue } = await import('@/queues/aiQueue');
      const q = getAIRequestQueue();
      const job = await q.add('AI_CHAT', {
        type: 'CHAT',
        payload: {
          messages,
          model: 'gpt-3.5-turbo',
          meta: { subject, language: resolvedLang, sessionUserId: sessionUser.id, userId },
        },
      });
      return NextResponse.json({ status: 'queued', jobId: job.id }, { status: 202 });
    } catch (e) {
      logger.error('Failed to enqueue AI chat request', {
        className: 'api.chat',
        methodName: 'POST',
        error: String(e),
      });
      return NextResponse.json({ error: 'Could not enqueue AI request' }, { status: 500 });
    }
  } catch (err) {
    logger.error('chat route error', { className: 'api.chat', methodName: 'POST', error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
