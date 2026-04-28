export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

/**
 * GET /api/health/redis
 * Pings Redis with a short SET/GET cycle.
 * Always returns 200 with { status, latencyMs }.
 */
export async function GET() {
  let latencyMs = -1;
  let status: 'ok' | 'degraded' = 'degraded';

  try {
    const redis = getRedis();
    if (!redis) {
      // Circuit open or client unavailable; treat as degraded with latency 0.
      latencyMs = 0;
    } else {
      const probeKey = 'health:redis:probe';
      const t0 = Date.now();
      await redis.set(probeKey, '1', 'EX', 10);
      await redis.get(probeKey);
      latencyMs = Date.now() - t0;
      status = latencyMs < 200 ? 'ok' : 'degraded';
    }
  } catch {
    // keep degraded + latency -1 to indicate failure
  }

  return NextResponse.json({ status, latencyMs });
}
