import Link from 'next/link'
import { headers } from 'next/headers'

export default async function Page() {
  // Use relative URL with proper host header for server-side fetch
  const headersList = headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || 'http'
  const baseUrl = `${protocol}://${host}`
  
  let data: any[] = []
  try {
    const res = await fetch(`${baseUrl}/api/learn/courses`, { cache: 'no-store' })
    if (res.ok) {
      data = await res.json()
    }
  } catch (e) {
    // Silently fail - show empty courses list
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>Courses</h1>
      {!Array.isArray(data) || data.length === 0 ? (
        <p style={{ color: '#666' }}>No courses available yet. Check back soon!</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {data.map((c: any) => (
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
      )}
    </div>
  )
}
