import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Prisma } from '@prisma/client';

type RequestBody = { code?: string };

async function doRedeem(userId: string, code: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // re-fetch referral inside transaction for consistent locking/context
    const referral = await tx.referral.findUnique({ where: { code } });
    if (!referral) return { status: 404, body: { error: 'Invalid code' } };

    // if already redeemed, idempotent success
    if (referral.redeemedBy) {
      return { status: 200, body: { ok: true, alreadyRedeemed: true } };
    }

    // mark referral redeemed (use id to avoid ambiguous predicate)
    await tx.referral.update({
      where: { id: referral.id },
      data: { redeemedBy: userId, redeemedAt: new Date() },
    });

    const REDEEM_POINTS = 50;
    // award points (redeemer + inviter) and ensure inviter exists
    await tx.user.update({ where: { id: userId }, data: { points: { increment: REDEEM_POINTS } } });
    if (referral.createdBy) {
      await tx.user.update({
        where: { id: referral.createdBy },
        data: { points: { increment: REDEEM_POINTS } },
      });
    }

    // ensure referral badge exists
    const badge = await tx.badge.upsert({
      where: { key: 'referral_invite' },
      update: {},
      create: {
        key: 'referral_invite',
        name: 'Invite Friend',
        description: 'Awarded for inviting a friend',
        icon: '🎉',
      },
    });

    // award inviter badge (idempotent)
    if (referral.createdBy) {
      await tx.userBadge.upsert({
        where: { userId_badgeId: { userId: referral.createdBy, badgeId: badge.id } },
        update: {},
        create: { userId: referral.createdBy, badgeId: badge.id },
      });
    }

    // award redeemer badge (idempotent)
    await tx.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
      update: {},
      create: { userId, badgeId: badge.id },
    });

    return { status: 200, body: { ok: true } };
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const raw = await req.json().catch(() => ({}) as unknown);
  const body = raw as RequestBody;
  const code = typeof body.code === 'string' ? body.code.trim() : undefined;
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  // attempt transaction, retry once on P2028 (transaction not found)
  try {
    const res = await doRedeem(userId, code);
    return NextResponse.json(res.body, { status: res.status });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2028') {
      try {
        const res = await doRedeem(userId, code);
        return NextResponse.json(res.body, { status: res.status });
      } catch {
        // Handle nested error
      }
    }
    // unique-constraint treated as idempotent success elsewhere; return 500 for unexpected
    return NextResponse.json({ error: 'redeem_failed', detail: String(e) }, { status: 500 });
  }
}
