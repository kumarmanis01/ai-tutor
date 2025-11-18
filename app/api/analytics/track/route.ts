import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';

export async function POST(req: Request) {
  logApiUsage('/api/analytics/track', 'POST');

  const body = await req.json().catch(() => ({}));
  const { event, data, ts } = body as { event?: string; data?: unknown; ts?: number };

  if (!event || typeof event !== 'string') {
    return NextResponse.json({ error: 'event required' }, { status: 400 });
  }

  // Always log server-side for quick verification (avoid PII)
  console.info('[analytics] event=', event, 'data=', data ?? null, 'ts=', ts ?? Date.now());

  try {
    // attach user if session exists
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      try {
        const created = await prisma.event.create({
          data: {
            userId: session.user.id,
            type: event,
            metadata: data ?? {},
            timestamp: new Date(ts ?? Date.now()),
          },
        });
        return NextResponse.json({ ok: true, eventId: created.id });
      } catch (dbErr) {
        // If DB write fails, still return success for client but log the DB error
        console.warn('[analytics] db write failed:', String(dbErr));
        return NextResponse.json({ ok: true });
      }
    }
  } catch (err) {
    console.error('[analytics] unexpected error:', err);
  }

  return NextResponse.json({ ok: true });
}
