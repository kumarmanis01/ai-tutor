import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const payments = await prisma.payment.findMany({
    where: { status: 'success' },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  logApiUsage('/api/admin/payments/success', 'GET');
  return NextResponse.json(payments);
}
