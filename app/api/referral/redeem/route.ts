import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logApiUsage } from '@/utils/logApiUsage';
import { Prisma } from '@prisma/client';

type RequestBody = { code?: string };

type RedeemResponse = {
  status: number;
  body: { error?: string; ok?: boolean; alreadyRedeemed?: boolean; voided?: boolean; badge?: unknown };
};

/** Extract client IP from request headers. Returns null if not determinable. */
function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? null;
}

async function doRedeem(userId: string, code: string, redeemerIp: string | null): Promise<RedeemResponse> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const referral = await tx.referral.findUnique({ where: { code } });
    if (!referral) return { status: 404, body: { error: 'Invalid code' } };

    if (referral.redeemedBy) {
      return { status: 200, body: { ok: true, alreadyRedeemed: true } };
    }

    // F-STU-042 AC-05: fraud detection -- self-referral or same-IP referral is voided
    if (referral.createdBy === userId) {
      return { status: 400, body: { error: 'Referral code cannot be used by its creator.', voided: true } };
    }
    const metadata = referral.metadata as Record<string, unknown> | null;
    const creatorIp = typeof metadata?.creatorIp === 'string' ? metadata.creatorIp : null;
    if (creatorIp && redeemerIp && creatorIp === redeemerIp) {
      return { status: 400, body: { error: 'Referral reward voided: same device or network detected.', voided: true } };
    }

    await tx.referral.update({
      where: { id: referral.id },
      data: { redeemedBy: userId, redeemedAt: new Date() },
    });

    const REDEEM_POINTS = 50;
    await tx.user.update({ where: { id: userId }, data: { points: { increment: REDEEM_POINTS } } });
    if (referral.createdBy) {
      await tx.user.update({
        where: { id: referral.createdBy },
        data: { points: { increment: REDEEM_POINTS } },
      });
    }

    const badge = await tx.badge.upsert({
      where: { key: 'referral_invite' },
      update: {},
      create: {
        key: 'referral_invite',
        name: 'Referral Inviter',
        description: 'Awarded for inviting friends to join.',
      },
    });

    return { status: 200, body: { ok: true, badge } };
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const redeemerIp = getClientIp(req);

  const raw = await req.json().catch(() => ({}) as unknown);
  const body = raw as RequestBody;
  const code = typeof body.code === 'string' ? body.code.trim() : undefined;
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  logApiUsage('/api/referral/redeem', 'POST');

  // attempt transaction, retry once on P2028 (transaction not found)
  try {
    const res = await doRedeem(userId, code, redeemerIp);
    return NextResponse.json(res.body, { status: res.status });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2028') {
      try {
        const res = await doRedeem(userId, code, redeemerIp);
        return NextResponse.json(res.body, { status: res.status });
      } catch {
        // Handle nested error
      }
    }
    // unique-constraint treated as idempotent success elsewhere; return 500 for unexpected
    return NextResponse.json({ error: 'redeem_failed', detail: String(e) }, { status: 500 });
  }
}
