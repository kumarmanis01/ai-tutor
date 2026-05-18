/**
 * FILE OBJECTIVE:
 * - Liveness probe endpoint for load balancers and uptime monitors.
 * - Returns a minimal JSON payload; intentionally avoids DB/Redis calls
 *   so it stays fast even under degraded infrastructure.
 *
 * LINKED UNIT TEST: none (trivial, no business logic)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-18T00:00:00Z | claude | created health liveness endpoint
 */
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
