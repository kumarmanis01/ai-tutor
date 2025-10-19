import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

type RequestBody = {
  code?: string;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = await req.json().catch(() => ({}) as unknown);
  const body = raw as RequestBody;
  const code = typeof body.code === 'string' ? body.code.trim() : undefined;

  if (!code) {
    return NextResponse.json({ error: 'code required' }, { status: 400 });
  }

  const referral = await prisma.referral.findUnique({ where: { code } });
  if (!referral) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 404 });
  }
  if (referral.redeemedBy) {
    return NextResponse.json({ ok: true, alreadyRedeemed: true });
  }

  await prisma.referral.update({
    where: { code },
    data: { redeemedBy: session.user.id, redeemedAt: new Date() },
  });

  // award a simple "Referral" badge to inviter and redeemer (idempotent-ish)
  const badge = await prisma.badge.upsert({
    where: { key: 'referral_invite' },
    update: {},
    create: {
      key: 'referral_invite',
      name: 'Invite Friend',
      description: 'Awarded for inviting a friend',
      icon: '🎉',
    },
  });

  // create userBadge for creator (ignore unique constraint errors)
  await prisma.userBadge
    .create({
      data: { userId: referral.createdBy, badgeId: badge.id, meta: { via: 'referral' } },
    })
    .catch(() => null);

  // create userBadge for redeemer
  await prisma.userBadge
    .create({
      data: { userId: session.user.id, badgeId: badge.id, meta: { via: 'referral' } },
    })
    .catch(() => null);

  return NextResponse.json({ ok: true });
}
