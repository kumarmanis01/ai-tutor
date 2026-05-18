export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * Basic liveness probe for load balancers and uptime monitors.
 * Does not check DB or Redis -- use /api/health/redis for Redis readiness.
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
