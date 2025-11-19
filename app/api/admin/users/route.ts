import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';

export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      status: true,
      role: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  logApiUsage('/api/admin/users', 'GET');
  return NextResponse.json(users);
}
