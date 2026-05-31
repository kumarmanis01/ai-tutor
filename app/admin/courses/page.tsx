import Link from 'next/link'

export default async function Page() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/courses`, { cache: 'no-store' })
  const data = await res.json()

  return (
    <div className="p-6">
      <h1>Published Courses</h1>
      <ul>
        {Array.isArray(data) && data.map((c: any) => (
          <li key={c.syllabusId} className="mb-3">
            <strong>{c.syllabusId}</strong> -- {c.title ?? 'Untitled'} -- latest: {c.latestVersion}
            {' '}
            <Link href={`/admin/courses/${c.syllabusId}`} className="ml-2">View versions</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
