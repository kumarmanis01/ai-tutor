/**
 * FILE OBJECTIVE:
 * - Expose Redis health details for admin status surfaces with explicit admin authorization handling.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/content-engine/redis/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-01T00:00:00Z | copilot | enforce shared admin guard and return 403 on unauthorized access
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { requireActiveAdmin } from '@/lib/admin/guards';
import { formatErrorForResponse } from '@/lib/errorResponse';

export async function GET() {
  try {
    const guard = await requireActiveAdmin();
    if (!guard.ok) {
      return NextResponse.json(
        { ok: false, error: { name: 'Error', message: 'Forbidden' } },
        { status: 403 }
      );
    }

    const r = getRedis();

    const [pong, infoRaw] = await Promise.all([r.ping(), r.info().catch(() => '')]);

    // Parse Redis INFO string into key=value map
    const infoMap: Record<string, string> = {};
    for (const line of infoRaw.split('\r\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) infoMap[line.slice(0, idx)] = line.slice(idx + 1);
    }

    return NextResponse.json({
      ok: true,
      ping: pong,
      usedMemory: infoMap['used_memory_human'] ?? null,
      maxmemoryPolicy: infoMap['maxmemory_policy'] ?? null,
      connectedClients: infoMap['connected_clients'] ? Number(infoMap['connected_clients']) : null,
      uptimeSeconds: infoMap['uptime_in_seconds'] ? Number(infoMap['uptime_in_seconds']) : null,
      redisVersion: infoMap['redis_version'] ?? null,
    });
  } catch (err) {
    logger?.error?.('GET /api/admin/content-engine/redis error', { err });
    return NextResponse.json({ ok: false, error: formatErrorForResponse(err) }, { status: 500 });
  }
}
