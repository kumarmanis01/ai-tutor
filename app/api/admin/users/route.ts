import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      status: true,
      role: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  logApiUsage('/api/admin/users', 'GET');
  return NextResponse.json(users);
}
