export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';

// GET /api/chat/history?subject=general&conversationId=conv_x&limit=50
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const subject = url.searchParams.get('subject') || 'general';
    const conversationId = url.searchParams.get('conversationId') || undefined;
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 200);

    const session = await getServerSessionForHandlers();
    const userId = (session as any)?.user?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: 'login_required' }, { status: 401 });

    const rows = await prisma.chat.findMany({
      where: { userId, subject, ...(conversationId ? { conversationId } : {}) },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const messages = rows.map((r) => ({
      id: String(r.id),
      role: r.role === 'assistant' ? 'assistant' : 'user',
      content: r.content,
    }));

    return NextResponse.json({ subject, conversationId, messages });
  } catch (e) {
    logger.error('GET /api/chat/history error', { className: 'api.chat.history', methodName: 'GET', error: e });
    return NextResponse.json({ error: formatErrorForResponse(e) }, { status: 500 });
  }
}
