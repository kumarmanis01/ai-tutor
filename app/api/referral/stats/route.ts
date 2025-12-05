import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logApiUsage } from '@/utils/logApiUsage';

export async function GET() {
  logApiUsage('/api/referral/stats', 'GET');
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const invites = await prisma.referral.findMany({
    where: { createdBy: session.user.id },
    orderBy: { createdAt: 'desc' },
  });
  const redeemedCount = invites.filter((r) => r.redeemedBy !== null).length;

  return NextResponse.json({ totalInvites: invites.length, redeemedCount, invites });
}
