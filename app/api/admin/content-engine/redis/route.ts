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
    const pong = await r.ping()
    return NextResponse.json({ ok: true, ping: pong })
  } catch (err) {
    logger?.error?.('GET /api/admin/content-engine/redis error', { err })
    logger.error('content-engine.redis failed', { error: err })
    return NextResponse.json({ ok: false, error: formatErrorForResponse(err) }, { status: 500 })
  }
}
