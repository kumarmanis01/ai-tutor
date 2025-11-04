import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Prisma } from '@prisma/client';

type RequestBody = {
  badgeId?: string;
  ts?: number;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = await req.json().catch(() => ({}) as unknown);
  const body = raw as RequestBody;
  const badgeId = typeof body.badgeId === 'string' ? body.badgeId : undefined;
  const ts = typeof body.ts === 'number' ? body.ts : undefined;

  if (!badgeId) {
    return NextResponse.json({ error: 'badgeId required' }, { status: 400 });
  }

  const timestamp = new Date(ts ?? Date.now());

  try {
    await prisma.event.create({
      data: {
        userId: session.user.id,
        type: 'badge_shared',
        metadata: { badgeId } as unknown as Prisma.InputJsonValue,
        timestamp,
      },
    });
  } catch (err) {
    console.error('[badges/share] db write failed:', err);
    // non-blocking: return ok but log the error
    return NextResponse.json({ ok: true, warning: 'db_write_failed' });
  }

  const base =
    process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const shareUrl = `${base}/profile/${session.user.id}#badge-${badgeId}`;

  return NextResponse.json({ ok: true, shareUrl });
}
