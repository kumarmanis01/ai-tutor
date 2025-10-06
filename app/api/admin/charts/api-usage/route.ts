import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  // Group API usage by day
  const usage = await prisma.apiUsage.groupBy({
    by: ['date'], // assuming you have a 'date' field (YYYY-MM-DD)
    _sum: { count: true },
    orderBy: { date: 'desc' },
    take: 30,
  });

  const data = usage.map((u) => ({
    period: u.date,
    count: u._sum.count,
  }));

  return NextResponse.json(data);
}
