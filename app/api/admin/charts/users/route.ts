// app/api/admin/charts/api-usage/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  // Example: group by day
  const usage = await prisma.apiUsage.groupBy({
    by: ['lastUsed'],
    _sum: { count: true },
    orderBy: { lastUsed: 'desc' },
    take: 30,
  });
  const data = usage.map((u) => ({
    period: u.lastUsed.toISOString().slice(0, 10),
    count: u._sum.count,
  }));
  return NextResponse.json(data);
}
