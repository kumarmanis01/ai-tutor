import { logger } from '@/lib/logger';
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
  logger.info('[analytics] event', { className: 'api.analytics.track', methodName: 'POST', event, data: data ?? null });

  try {
    await logEvent(event, data ?? {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[analytics] unexpected error', { className: 'api.analytics.track', methodName: 'POST', error: String(err) });
  }

  return NextResponse.json({ ok: true });
}
