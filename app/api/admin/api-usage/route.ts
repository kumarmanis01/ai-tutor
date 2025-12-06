import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logApiUsage } from '@/utils/logApiUsage';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const usage = await prisma.apiUsage.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { lastUsed: 'desc' },
    take: 100,
  });
  logApiUsage('/api/admin/api-usage', 'GET');

  return NextResponse.json(usage);
}
