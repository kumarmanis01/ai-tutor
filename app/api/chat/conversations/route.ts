export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';

// GET /api/chat/conversations?subject=general&limit=50
// Returns a list of conversation threads for the current user within a subject
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const subject = url.searchParams.get('subject') || 'general';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 200);

    const session = await getServerSessionForHandlers();
    const userId = (session as any)?.user?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: 'login_required' }, { status: 401 });

    // Fetch recent chats for the subject and user; we will group by conversationId
    const rows = await prisma.chat.findMany({
      where: { userId, subject },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { id: true, conversationId: true, content: true, role: true, createdAt: true },
    });

    const byConv: Record<string, { conversationId: string; lastMessage: string; lastRole: 'user' | 'assistant'; updatedAt: Date; count: number }> = {};
    for (const r of rows) {
      const cid = (r.conversationId || '').trim();
      if (!cid) continue; // skip legacy items without conversationId
      if (!byConv[cid]) {
        byConv[cid] = {
          conversationId: cid,
          lastMessage: r.content,
          lastRole: r.role === 'assistant' ? 'assistant' : 'user',
          updatedAt: r.createdAt,
          count: 1,
        };
      } else {
        byConv[cid].count += 1;
        // keep the most recent updatedAt and lastMessage from first iteration (rows are desc already)
      }
    }

    const threads = Object.values(byConv)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit)
      .map((t) => ({
        conversationId: t.conversationId,
        lastMessage: t.lastMessage,
        lastRole: t.lastRole,
        updatedAt: t.updatedAt,
        count: t.count,
      }));

    return NextResponse.json({ subject, threads });
  } catch (e) {
    logger.error('GET /api/chat/conversations error', { className: 'api.chat.conversations', methodName: 'GET', error: e });
    return NextResponse.json({ error: formatErrorForResponse(e) }, { status: 500 });
  }
}
