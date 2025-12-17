import React from 'react'
import WorkerControl from '@/components/Admin/WorkerControl'
import { requireAdminOrModerator } from '@/lib/auth'

export default async function Page() {
  await requireAdminOrModerator()
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Workers</h2>
      <WorkerControl />
    </div>
  )
}
