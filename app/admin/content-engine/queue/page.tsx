export const dynamic = 'force-dynamic'

import React from 'react'
import { getContentQueue } from '@/queues/contentQueue'
import { requireAdminOrModerator } from '@/lib/auth'
import { logger } from '@/lib/logger'


export default async function QueuePage() {
  try {
    await requireAdminOrModerator()
    const q = getContentQueue()
    const counts = await q.getJobCounts()

    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Content Engine — Queue</h1>
        <div className="bg-white dark:bg-gray-900 rounded shadow p-4">
          <pre className="text-sm whitespace-pre-wrap">{JSON.stringify({ queue: 'content-hydration', counts }, null, 2)}</pre>
        </div>
      </div>
    )
  } catch (err) {
    logger?.error?.('GET /admin/content-engine/queue page error', { err })
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Content Engine — Queue</h1>
        <div className="text-sm text-gray-500">Unable to fetch queue info.</div>
      </div>
    )
  }
}
