import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { SessionUser } from '@/lib/types';
import { logApiUsage } from '@/utils/logApiUsage';

/**
 * Persists chat history for a logged-in user
 * Request: { messages: [{ role: "user"|"ai", content: string }] }
 */
export async function POST(req: Request) {
  logApiUsage('/api/save-chats', 'POST');
  const session = await getServerSessionForHandlers();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sessionUser = session.user as SessionUser;

  if (!sessionUser || !sessionUser.email || !sessionUser.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('SaveChats API error', { className: 'api.save-chats', methodName: 'POST', error: String(err) });
    return NextResponse.json({ error: 'Failed to save chats' }, { status: 500 });
  }
}
