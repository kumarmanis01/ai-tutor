import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logApiUsage } from '@/utils/logApiUsage';

type Body = {
  key: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  rewardPoints?: number;
  rewardBadgeId?: string | null;
};

type SessionUserWithRole = {
  role?: string | null;
} & Record<string, unknown>;

export async function POST(req: Request) {
  logApiUsage('/api/admin/challenges/create', 'POST');
  const session = await getServerSessionForHandlers();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as SessionUserWithRole;
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json()) as Body;
  if (!body.key || !body.title || !body.startAt || !body.endAt) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const start = new Date(body.startAt);
  const end = new Date(body.endAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return NextResponse.json({ error: 'Invalid start/end dates' }, { status: 400 });
  }

  try {
    const created = await prisma.challenge.create({
      data: {
        key: body.key,
        title: body.title,
        description: body.description ?? null,
        startAt: start,
        endAt: end,
        rewardPoints: body.rewardPoints ?? 0,
        rewardBadgeId: body.rewardBadgeId ?? null,
      },
    });
    return NextResponse.json({ ok: true, challenge: created });
  } catch (e: unknown) {
    return NextResponse.json({ error: 'db_error', detail: String(e) }, { status: 500 });
  }
}
