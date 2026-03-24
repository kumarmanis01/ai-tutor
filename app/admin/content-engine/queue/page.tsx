"use client";
export const dynamic = 'force-dynamic'

import React from 'react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function StatCard({ label, value, color }: { label: string; value: number | undefined; color: 'yellow' | 'blue' | 'green' | 'red' | 'gray' }) {
  const classes: Record<string, string> = {
    yellow: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
    green: 'bg-green-50 text-green-800 border-green-200',
    red: 'bg-red-50 text-red-800 border-red-200',
    gray: 'bg-gray-50 text-gray-800 border-gray-200',
  }
  return (
    <div className={`rounded-lg border p-4 text-center ${classes[color]}`}>
      <div className="text-2xl font-bold">{value ?? '-'}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  )
}

export default function QueuePage() {
  const { data, error, mutate } = useSWR('/api/admin/content-engine/queue', fetcher, { refreshInterval: 10000 })

  const retryJob = async (jobId: string) => {
    await fetch(`/api/admin/hydrateAll/${jobId}/retry`, { method: 'POST' })
    mutate()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Content Engine -- Queue</h1>
        <button onClick={() => mutate()} className="text-sm text-blue-600 hover:underline">Refresh</button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 mb-6">
          {"Couldn't load queue info -- tap to retry"}
        </div>
      )}

      {!data && !error && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-pulse">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-200 rounded-lg" />)}
        </div>
      )}

      {data && (
        <>
          <p className="text-xs text-gray-500 mb-4">Queue: <code className="bg-gray-100 px-1 rounded">{data.queue}</code></p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Waiting" value={data.counts?.waiting} color="yellow" />
            <StatCard label="Active" value={data.counts?.active} color="blue" />
            <StatCard label="Completed" value={data.counts?.completed} color="green" />
            <StatCard label="Failed" value={data.counts?.failed} color="red" />
          </div>

          {data.failedJobs?.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Failed Jobs (last 20)</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Job ID</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.failedJobs.map((job: any) => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-xs text-gray-500">{job.id.slice(0, 10)}...</td>
                        <td className="px-4 py-2">{job.jobType}</td>
                        <td className="px-4 py-2 text-gray-600 text-xs">{job.subject || '-'}{job.board ? ` (${job.board} Gr.${job.grade})` : ''}</td>
                        <td className="px-4 py-2 max-w-xs truncate text-red-700 text-xs">{job.lastError || '-'}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => retryJob(job.id)}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 min-h-[28px]"
                          >
                            Retry
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.failedJobs?.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">No failed jobs -- queue is healthy.</div>
          )}
        </>
      )}
    </div>
  )
}
