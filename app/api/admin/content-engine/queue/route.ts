export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getContentQueue } from '@/queues/contentQueue'
import { logger } from '@/lib/logger'
import { requireAdminOrModerator } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CONTENT_HYDRATION_QUEUE } from '@/lib/queues/constants'

export async function GET() {
  try {
    await requireAdminOrModerator();
    const q = getContentQueue()
    const [counts, failedJobs] = await Promise.all([
      q.getJobCounts(),
      prisma.hydrationJob.findMany({
        where: { status: 'failed' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          jobType: true,
          lastError: true,
          createdAt: true,
          board: true,
          grade: true,
          subject: true,
          language: true,
        },
      }),
    ])
    return NextResponse.json({ queue: 'content-hydration', counts, failedJobs })
  } catch (err) {
    logger?.error?.('GET /api/admin/content-engine/queue error', { err })
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
