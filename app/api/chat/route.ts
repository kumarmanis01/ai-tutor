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
    // Enqueue AI request to worker queue instead of calling OpenAI directly
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
      logger.error('Failed to enqueue AI chat request', { className: 'api.chat', methodName: 'POST', error: String(e) });
      return NextResponse.json({ error: 'Could not enqueue AI request' }, { status: 500 });
    }
    // Enqueue-response path returns above; nothing more to do here in the web handler.
  } catch (err) {
    logger.error('chat route error', { className: 'api.chat', methodName: 'POST', error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
