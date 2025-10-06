import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const payments = await prisma.payment.findMany({
    where: { status: 'success' },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(payments);
}
