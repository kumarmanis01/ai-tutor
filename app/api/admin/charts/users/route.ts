import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  logApiUsage('/api/admin/charts/users', 'GET');
  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(logs);
}
