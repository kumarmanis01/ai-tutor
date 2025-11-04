import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function POST(req: Request) {
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
        // best-effort: persist if Event model exists in your Prisma schema
        // cast metadata to Prisma.InputJsonValue to satisfy Prisma types
        const metadata = (data as Prisma.InputJsonValue) ?? {};
        const created = await prisma.event.create({
          data: {
            userId: session.user.id,
            type: event,
            metadata,
            // removed `timestamp` because it does not exist on your Prisma Event model
          },
        });
        return NextResponse.json({ ok: true, eventId: created.id });
      } catch (dbErr) {
        // If DB write fails, still return success for client but log the DB error
        console.warn('[analytics] db write failed:', String(dbErr));
        return NextResponse.json({ ok: true });
      }
    }

    // anonymous event -> accepted
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[analytics] error:', err);
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 });
  }
}
