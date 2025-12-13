"use client"
import useSWR from "swr"

export default function AIDashboard() {
  const { data, mutate } = useSWR("/api/admin/ai/status")

  if (!data) return null

  return (
    <div>
      <h1>AI Dashboard</h1>

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
