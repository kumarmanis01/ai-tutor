import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/admin/payments/success
// Returns the 100 most recent successful payments
export async function GET() {
  const payments = await prisma.payment.findMany({
    where: { status: 'success' },
    include: { user: { select: { email: true } }, subscription: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(payments);
}
