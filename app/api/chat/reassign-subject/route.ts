import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';

// POST /api/chat/reassign-subject
// Body: { conversationId: string, subject: string }
// Reassigns all chats in a conversation to the provided subject for the current user
export async function POST(req: Request) {
  try {
    const session = await getServerSessionForHandlers();
    const userId = (session as any)?.user?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: 'login_required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    if (!conversationId || !subject) return NextResponse.json({ error: 'missing_params' }, { status: 400 });

    const result = await prisma.chat.updateMany({
      where: { userId, conversationId },
      data: { subject },
    });

    return NextResponse.json({ ok: true, updated: result.count, conversationId, subject });
  } catch (e) {
    logger.error('POST /api/chat/reassign-subject error', { className: 'api.chat.reassignSubject', methodName: 'POST', error: e });
    return NextResponse.json({ error: formatErrorForResponse(e) }, { status: 500 });
  }
}
