export const dynamic = 'force-dynamic'

import React from 'react'
import { getRedis } from '@/lib/redis'
import { requireAdminOrModerator } from '@/lib/auth'
import { logger } from '@/lib/logger'


export default async function RedisPage() {
  try {
    await requireAdminOrModerator()
    const r = getRedis()
    const pong = await r.ping()
    const data = { ok: true, ping: pong }

    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Content Engine — Redis</h1>
        <div className="bg-white dark:bg-gray-900 rounded shadow p-4">
          <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
        </div>
      </div>
    )
  } catch (err) {
    logger?.error?.('GET /admin/content-engine/redis page error', { err })
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Content Engine — Redis</h1>
        <div className="text-sm text-gray-500">Unable to fetch Redis health.</div>
      </div>
    )
  }
}
