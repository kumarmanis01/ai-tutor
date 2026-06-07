/**
 * GET /api/session/lookup?id=xxx
 *
 * Used by middleware to resolve legacy /session/[sessionId] URLs.
 * If id is a StructuredSession id, returns { topicId }. Otherwise 404
 * (caller falls back to treating the value as a raw topicId).
 *
 * Auth: requires an active session. The lookup itself only returns a
 * topicId, but unauthenticated callers could enumerate session ids and
 * map them to topics if left open.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await getServerSessionForHandlers();
  const userId = (auth?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  // Scope the lookup to the caller's own sessions so we don't leak the
  // topicId mapping of someone else's StructuredSession row.
  const session = await prisma.structuredSession.findFirst({
    where: { id, studentId: userId },
    select: { topicId: true },
  });

  if (!session) {
    return NextResponse.json(null, { status: 404 });
  }

  return NextResponse.json({ topicId: session.topicId });
}
