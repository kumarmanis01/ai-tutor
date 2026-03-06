/**
 * FILE OBJECTIVE:
 * - Admin API endpoint to query RecommendationTrace records for observability.
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
  const topicId = url.searchParams.get('topicId') || undefined;
  const dateFrom = url.searchParams.get('dateFrom') || undefined;
  const dateTo = url.searchParams.get('dateTo') || undefined;
  const limit = Math.min(Number(url.searchParams.get('limit') || '100'), 200);

  const createdAtFilter: Record<string, Date> = {};
  if (dateFrom) createdAtFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    createdAtFilter.lte = end;
  }

  const traces = await prisma.recommendationTrace.findMany({
    where: {
      ...(studentId ? { studentId } : {}),
      ...(entityType ? { entityType } : {}),
      ...(topicId ? { entityId: { contains: topicId } } : {}),
      ...(Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({ traces, count: traces.length });
}
