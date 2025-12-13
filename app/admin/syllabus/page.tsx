"use client"
import useSWR from "swr"

export default function SyllabusPage() {
  const { data } = useSWR("/api/admin/syllabus")

  if (!data) return <p>Loading...</p>

  return (
    <div>
      <h1>Syllabus</h1>
      {data.chapters.map((c: any) => (
        <div key={c.id}>
          <h2>{c.name} ({c.status})</h2>
          {c.topics.map((t: any) => (
            <div key={t.id}>
              {t.name}
              <button onClick={() =>
                fetch(`/api/admin/topics/${t.id}/generate`, { method: "POST" })
              }>Generate</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
