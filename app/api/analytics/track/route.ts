import { NextResponse } from 'next/server';
import { logApiUsage } from '@/utils/logApiUsage';
import { logEvent } from '@/utils/logEvent';
import { Prisma } from '@prisma/client';

export async function POST(req: Request) {
  logApiUsage('/api/analytics/track', 'POST');

  const body = await req.json().catch(() => ({}));
  const { event, data } = body as { event?: string; data?: Prisma.InputJsonValue };

  if (!event || typeof event !== 'string') {
    return NextResponse.json({ error: 'event required' }, { status: 400 });
  }

  // Always log server-side for quick verification (avoid PII)
  console.info('[analytics] event=', event, 'data=', data ?? null);

  try {
    await logEvent(event, data ?? {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[analytics] unexpected error:', err);
  }

  return NextResponse.json({ ok: true });
}
