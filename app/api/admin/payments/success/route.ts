import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';

export async function GET() {
  const payments = await prisma.payment.findMany({
    where: { status: 'success' },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  logApiUsage('/api/admin/payments/success', 'GET');
  return NextResponse.json(payments);
}
