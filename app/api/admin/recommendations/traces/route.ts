/**
 * FILE OBJECTIVE:
 * - Admin API endpoint to query RecommendationTrace records for observability.
 *
 * EDIT LOG:
 * - 2026-03-03 | claude | created recommendation trace API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const studentId = url.searchParams.get('studentId') || undefined;
  const entityType = url.searchParams.get('entityType') || undefined;
  const limit = Math.min(Number(url.searchParams.get('limit') || '100'), 200);

  const traces = await prisma.recommendationTrace.findMany({
    where: {
      ...(studentId ? { studentId } : {}),
      ...(entityType ? { entityType } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({ traces, count: traces.length });
}
