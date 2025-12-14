"use client"
import PendingContent from "@/components/Admin/PendingContenet"
import useSWR from "swr"

export default function AIDashboard() {
  const { data, mutate } = useSWR("/api/admin/ai/status")

  if (!data) return null

  return (
    <div>
      <h1>AI Dashboard</h1>
<div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Admin Dashboard</h1>
      <PendingContent />
    </div>

      <p>Status: {data.paused ? "Paused" : "Running"}</p>

      <button onClick={() =>
        fetch("/api/admin/ai/pause", { method: "POST" }).then(mutate)
      }>Pause</button>

      <button onClick={() =>
        fetch("/api/admin/ai/resume", { method: "POST" }).then(mutate)
      }>Resume</button>

      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
