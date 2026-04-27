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

  // Rewards summary: referral rewards applied/pending for this user
  const rewards = await prisma.referralReward.findMany({ where: { userId: session.user.id } });
  const rewardsEarned = rewards.filter((r) => r.status === 'APPLIED').length;
  const rewardsPending = rewards.filter((r) => r.status === 'PENDING').length;
  const rewardsEarnedAmount = rewards.filter((r) => r.status === 'APPLIED').reduce((s, r) => s + (r.amount || 0), 0);

  return NextResponse.json({ totalInvites: invites.length, redeemedCount, invites, rewards: { rewardsEarned, rewardsPending, rewardsEarnedAmount } });
}
