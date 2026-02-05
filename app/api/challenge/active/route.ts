import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date();
  const challenge = await prisma.challenge.findFirst({
    where: { startAt: { lte: now }, endAt: { gte: now } },
    include: { rewardBadge: true },
  });
  logApiUsage('/api/challenge/active', 'GET');
  return NextResponse.json({ challenge });
}
