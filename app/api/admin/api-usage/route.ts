import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const usage = await prisma.apiUsage.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { lastUsed: 'desc' },
    take: 100,
  });
  return NextResponse.json(usage);
}
