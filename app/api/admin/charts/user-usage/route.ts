import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/admin/charts/user-usage
// Returns API usage grouped by user
export async function GET() {
  const usage = await prisma.apiUsage.groupBy({
    by: ['userId'],
    _sum: { count: true },
    orderBy: { _sum: { count: 'desc' } },
    take: 100,
  });

  const users = await prisma.user.findMany({
    where: { id: { in: usage.map((u) => u.userId!) } },
    select: { id: true, email: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.email]));

  const data = usage.map((u) => ({
    userId: u.userId,
    email: userMap[u.userId!] || 'Unknown',
    count: u._sum.count,
  }));

  return NextResponse.json(data);
}
