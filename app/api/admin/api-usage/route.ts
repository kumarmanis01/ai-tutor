import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';

export async function GET() {
  const usage = await prisma.apiUsage.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { lastUsed: 'desc' },
    take: 100,
  });
  logApiUsage('/api/admin/api-usage', 'GET');

  return NextResponse.json(usage);
}
