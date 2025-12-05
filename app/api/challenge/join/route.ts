import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logApiUsage } from '@/utils/logApiUsage';

type Body = { challengeId?: string };

export async function POST(req: Request) {
  logApiUsage('/api/challenge/join', 'POST');
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = await req.json().catch(() => ({}) as unknown);
  const body = raw as Body;
  if (!body.challengeId)
    return NextResponse.json({ error: 'challengeId required' }, { status: 400 });

  try {
    const cp = await prisma.challengeParticipation.upsert({
      where: { challengeId_userId: { challengeId: body.challengeId, userId: session.user.id } },
      update: { status: 'joined' }, // safe no-op if already joined/completed
      create: { challengeId: body.challengeId, userId: session.user.id, status: 'joined' },
    });
    return NextResponse.json({ ok: true, participation: cp });
  } catch (e) {
    return NextResponse.json({ error: 'db_error', detail: String(e) }, { status: 500 });
  }
}
