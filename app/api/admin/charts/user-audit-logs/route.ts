import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(logs);
}
