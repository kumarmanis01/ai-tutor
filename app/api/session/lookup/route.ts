/**
 * GET /api/session/lookup?id=xxx
 *
 * Used by middleware to resolve legacy /session/[sessionId] URLs.
 * If id is a StructuredSession id, returns { topicId }. Otherwise 404 (treat as topicId).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const session = await prisma.structuredSession.findUnique({
    where: { id },
    select: { topicId: true },
  });

  if (!session) {
    return NextResponse.json(null, { status: 404 });
  }

  return NextResponse.json({ topicId: session.topicId });
}
