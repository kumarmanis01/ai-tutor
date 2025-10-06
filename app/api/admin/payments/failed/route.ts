import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/admin/payments/failed
// Returns the 100 most recent failed payments
export async function GET() {
  const payments = await prisma.payment.findMany({
    where: { status: 'failed' },
    include: { user: { select: { email: true } }, subscription: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(payments);
}
