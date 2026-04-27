"use client"

import { useEffect, useState } from "react"

export default function PendingContent() {
  const [chapters, setChapters] = useState([])

  useEffect(() => {
    fetch("/api/admin/content/pending")
      .then(res => res.json())
      .then(data => setChapters(data.chapters))
  }, [])

  return (
    <div className="space-y-3">
      {chapters.map((c: any) => (
        <div
          key={c.id}
          className="border rounded p-3 flex justify-between"
        >
          <div>
            <div className="font-medium">{c.name}</div>
            <div className="text-sm text-gray-500">
              {c.subject.name}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => approve(c.id)}
              className="px-3 py-1 bg-green-600 text-white rounded"
            >
              Approve
            </button>
            <button
              onClick={() => reject(c.id)}
              className="px-3 py-1 bg-red-500 text-white rounded"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

async function approve(id: string) {
  await fetch(`/api/admin/chapters/${id}/approve`, { method: "POST" })
  location.reload()
}

async function reject(id: string) {
  const reason = prompt("Reason for rejection?")
  await fetch(`/api/admin/chapters/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
  location.reload()
}
