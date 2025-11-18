import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';

export async function GET() {
  const top = await prisma.user.findMany({
    orderBy: { points: 'desc' },
    take: 20,
    select: { id: true, name: true, image: true, points: true },
  });
  logApiUsage('/api/leaderboard', 'GET');
  return NextResponse.json({ top });
}
