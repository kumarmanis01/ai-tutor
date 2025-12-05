import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logApiUsage } from '@/utils/logApiUsage';

type Body = { challengeId?: string; score?: number };

export async function POST(req: Request) {
  logApiUsage('/api/challenge/submit', 'POST');
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const raw = await req.json().catch(() => ({}) as unknown);
  const body = raw as Body;
  if (!body.challengeId)
    return NextResponse.json({ error: 'challengeId required' }, { status: 400 });

  const now = new Date();

  // Upsert participation (ensures single row per user+challenge)
  const participation = await prisma.challengeParticipation.upsert({
    where: { challengeId_userId: { challengeId: body.challengeId, userId } },
    update: { status: 'completed', score: body.score ?? null, submittedAt: now },
    create: {
      challengeId: body.challengeId,
      userId,
      status: 'completed',
      score: body.score ?? null,
      submittedAt: now,
    },
  });

  // If rewards already applied, return idempotent success
  if (participation.rewardApplied) return NextResponse.json({ ok: true, alreadyRewarded: true });

  const challenge = await prisma.challenge.findUnique({ where: { id: body.challengeId } });
  if (!challenge) return NextResponse.json({ error: 'challenge not found' }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      if ((challenge.rewardPoints ?? 0) > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { points: { increment: challenge.rewardPoints } },
        });
      }

      if (challenge.rewardBadgeId) {
        await tx.userBadge.upsert({
          where: { userId_badgeId: { userId, badgeId: challenge.rewardBadgeId } },
          update: {},
          create: { userId, badgeId: challenge.rewardBadgeId },
        });
      }

      // mark participation rewarded to avoid re-applying
      await tx.challengeParticipation.update({
        where: { id: participation.id },
        data: { rewardApplied: true },
      });

      // optional analytics event
      await tx.event.create({
        data: {
          userId,
          type: 'challenge_completed',
          metadata: { challengeId: challenge.id, score: body.score ?? null },
        },
      });
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2002') return NextResponse.json({ ok: true }); // treat dup as idempotent
    throw e;
  }

  return NextResponse.json({ ok: true, participation });
}
