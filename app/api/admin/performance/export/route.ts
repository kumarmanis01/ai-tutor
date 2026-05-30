/**
 * GET /api/admin/performance/export
 * Returns a CSV of SlowQueryLog rows from the past 7 days.
 * Admin-only: returns 401 for non-admin sessions.
 */
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headersList = await headers();
  const session = await getServerSessionForHandlers(headersList);
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.slowQueryLog.findMany({
    where: { createdAt: { gte: since7d } },
    select: { id: true, model: true, operation: true, durationMs: true, threshold: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const csvLines = [
    'id,model,operation,durationMs,threshold,createdAt',
    ...rows.map((r) =>
      [
        r.id,
        r.model ?? '',
        r.operation,
        r.durationMs,
        r.threshold,
        r.createdAt.toISOString(),
      ].join(',')
    ),
  ];
  const csv = csvLines.join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="slow-queries-7d.csv"`,
    },
  });
}
