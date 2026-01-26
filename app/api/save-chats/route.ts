import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { SessionUser } from '@/lib/types';

/**
 * Persists chat history for a logged-in user
 * Request: { messages: [{ role: "user"|"ai", content: string }] }
 */
export async function POST(req: Request) {
  const start = Date.now();
  // logApiUsage('/api/save-chats', 'POST');
  const session = await getServerSessionForHandlers();
  let res: Response;
  if (!session) {
    res = new Response('Unauthorized', { status: 401 });
    logger.logAPI(req, res, { className: 'SaveChatsAPI', methodName: 'POST' }, start);
    return res;
  }

  const sessionUser = session.user as SessionUser;

  if (!sessionUser || !sessionUser.email || !sessionUser.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'SaveChatsAPI', methodName: 'POST' }, start);
    return res;
  }

  try {
    const body = await req.json();
    const { messages } = body;

    await prisma.chatHistory.create({
      data: {
        userId: sessionUser.id, // Now guaranteed to be string
        messages: JSON.stringify(messages),
      },
    });

    res = NextResponse.json({ success: true });
    logger.logAPI(req, res, { className: 'SaveChatsAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('SaveChats API error', { className: 'api.save-chats', methodName: 'POST', error: err });
    res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
    logger.logAPI(req, res, { className: 'SaveChatsAPI', methodName: 'POST' }, start);
    return res;
  }
}
