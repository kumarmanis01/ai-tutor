export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { requireAdminOrModerator } from '@/lib/auth'
import { formatErrorForResponse } from '@/lib/errorResponse'

export async function GET() {
  try {
    await requireAdminOrModerator();
    const r = getRedis()
    if (!r) return NextResponse.json({ error: 'Redis not configured' }, { status: 503 })

    const [pong, infoRaw] = await Promise.all([
      r.ping(),
      r.info().catch(() => ''),
    ])

    // Parse Redis INFO string into key=value map
    const infoMap: Record<string, string> = {}
    for (const line of infoRaw.split('\r\n')) {
      const idx = line.indexOf(':')
      if (idx > 0) infoMap[line.slice(0, idx)] = line.slice(idx + 1)
    }

    return NextResponse.json({
      ok: true,
      ping: pong,
      usedMemory: infoMap['used_memory_human'] ?? null,
      maxmemoryPolicy: infoMap['maxmemory_policy'] ?? null,
      connectedClients: infoMap['connected_clients'] ? Number(infoMap['connected_clients']) : null,
      uptimeSeconds: infoMap['uptime_in_seconds'] ? Number(infoMap['uptime_in_seconds']) : null,
      redisVersion: infoMap['redis_version'] ?? null,
    })
  } catch (err) {
    logger?.error?.('GET /api/admin/content-engine/redis error', { err })
    return NextResponse.json({ ok: false, error: formatErrorForResponse(err) }, { status: 500 })
  }
}
