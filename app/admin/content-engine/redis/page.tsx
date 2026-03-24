"use client";
export const dynamic = 'force-dynamic'

import React from 'react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function StatusRow({ label, value, status }: { label: string; value: string | number | null; status: 'green' | 'red' | 'neutral' }) {
  const dot: Record<string, string> = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    neutral: 'bg-gray-400',
  }
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dot[status]}`} />
        <span className="text-sm font-medium text-gray-900">{value ?? '--'}</span>
      </div>
    </div>
  )
}

function formatUptime(seconds: number | null): string {
  if (!seconds) return '--'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function RedisPage() {
  const { data, error, mutate } = useSWR('/api/admin/content-engine/redis', fetcher, { refreshInterval: 15000 })

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Content Engine -- Redis</h1>
        <button onClick={() => mutate()} className="text-sm text-blue-600 hover:underline">Refresh</button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
          {"Couldn't connect to Redis -- tap to retry"}
        </div>
      )}

      {!data && !error && (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-gray-200 rounded" />)}
        </div>
      )}

      {data && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 p-6">
          <StatusRow
            label="Connection"
            value={data.ok ? 'Connected' : 'Disconnected'}
            status={data.ok ? 'green' : 'red'}
          />
          <StatusRow
            label="Ping"
            value={data.ping ?? '--'}
            status="neutral"
          />
          <StatusRow
            label="Redis Version"
            value={data.redisVersion}
            status="neutral"
          />
          <StatusRow
            label="Memory Used"
            value={data.usedMemory}
            status="neutral"
          />
          <StatusRow
            label="Eviction Policy"
            value={data.maxmemoryPolicy}
            status={data.maxmemoryPolicy === 'noeviction' ? 'red' : 'green'}
          />
          <StatusRow
            label="Connected Clients"
            value={data.connectedClients}
            status="neutral"
          />
          <StatusRow
            label="Uptime"
            value={formatUptime(data.uptimeSeconds)}
            status="neutral"
          />
        </div>
      )}
    </div>
  )
}
