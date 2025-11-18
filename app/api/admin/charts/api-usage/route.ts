import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';

export async function GET() {
  logApiUsage('/api/admin/charts/api-usage', 'GET');
  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(logs);
}
