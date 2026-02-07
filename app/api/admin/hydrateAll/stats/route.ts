import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalJobs, runningJobs, completedToday, costAgg] = await Promise.all([
    prisma.hydrationJob.count({ where: { rootJobId: null } }),
    prisma.hydrationJob.count({ where: { rootJobId: null, status: 'running' } }),
    prisma.hydrationJob.count({
      where: { rootJobId: null, status: 'completed', completedAt: { gte: startOfDay } },
    }),
    prisma.hydrationJob.aggregate({
      where: { rootJobId: null, completedAt: { gte: startOfDay } },
      _sum: { actualCostUsd: true },
    }),
  ]);

  return NextResponse.json({
    totalJobs,
    runningJobs,
    completedToday,
    totalCostToday: costAgg._sum.actualCostUsd ?? 0,
  });
}
