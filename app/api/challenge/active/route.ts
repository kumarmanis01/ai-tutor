import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const now = new Date();
  const challenge = await prisma.challenge.findFirst({
    where: { startAt: { lte: now }, endAt: { gte: now } },
    include: { rewardBadge: true },
  });
  return NextResponse.json({ challenge });
}
