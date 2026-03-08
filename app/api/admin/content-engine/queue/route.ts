export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getContentQueue } from '@/queues/contentQueue'
import { logger } from '@/lib/logger'
import { requireAdminOrModerator } from '@/lib/auth'
import { CONTENT_HYDRATION_QUEUE } from '@/lib/queues/constants'

export async function GET() {
  try {
    await requireAdminOrModerator();
    const q = getContentQueue()
    const counts = await q.getJobCounts()
    return NextResponse.json({ queue: CONTENT_HYDRATION_QUEUE, counts })
  } catch (err) {
    logger?.error?.('GET /api/admin/content-engine/queue error', { err })
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
