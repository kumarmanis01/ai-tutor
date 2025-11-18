import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';

export async function GET() {
  logApiUsage('/api/admin/payments/failed', 'GET');
  const payments = await prisma.payment.findMany({
    where: { status: 'failed' },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(payments);
}
