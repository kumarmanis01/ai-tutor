import Link from 'next/link'

export default async function Page() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/courses`, { cache: 'no-store' })
  const data = await res.json()

  return (
    <div style={{ padding: 24 }}>
      <h1>Published Courses</h1>
      <ul>
        {Array.isArray(data) && data.map((c: any) => (
          <li key={c.syllabusId} style={{ marginBottom: 12 }}>
            <strong>{c.syllabusId}</strong> — {c.title ?? 'Untitled'} — latest: {c.latestVersion}
            {' '}
            <Link href={`/admin/courses/${c.syllabusId}`} style={{ marginLeft: 8 }}>View versions</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
