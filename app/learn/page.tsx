import Link from 'next/link'

export default async function Page() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/learn/courses`, { cache: 'no-store' })
  const data = await res.json()

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>Courses</h1>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {Array.isArray(data) && data.map((c: any) => (
          <li key={c.courseId} style={{ marginBottom: 12, borderRadius: 8, padding: 12, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Link href={`/learn/${c.courseId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.title ?? c.courseId}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>Latest v{c.version}</div>
                </div>
                <div style={{ fontSize: 12, color: '#0070f3' }}>Open</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
