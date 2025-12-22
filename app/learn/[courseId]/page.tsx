import Link from 'next/link'

type Props = { params: { courseId: string } }

function flattenLessons(pkg: any) {
  const lessons: any[] = []
  if (!pkg || !Array.isArray(pkg.modules)) return lessons
  for (const m of pkg.modules) {
    if (Array.isArray(m.lessons)) {
      for (const l of m.lessons) lessons.push(l)
    }
  }
  return lessons
}

export default async function Page({ params }: Props) {
  const { courseId } = params
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/learn/courses/${courseId}`, { cache: 'no-store' })
  if (!res.ok) return (<div style={{ padding: 16 }}><h1>Course not found</h1></div>)
  const pkg = await res.json()
  const lessons = flattenLessons(pkg)

  return (
    <div style={{ padding: 16 }}>
      <Link href="/learn" style={{ fontSize: 13, color: '#0070f3' }}>← Back to courses</Link>
      <h1 style={{ fontSize: 20, marginTop: 8 }}>{pkg.title ?? courseId}</h1>
      <p style={{ color: '#666' }}>{pkg.description}</p>

      <h2 style={{ fontSize: 16, marginTop: 16 }}>Lessons</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {lessons.map((l: any, i: number) => (
          <li key={l.id ?? i} style={{ padding: 10, borderBottom: '1px solid #eee' }}>
            <Link href={`/learn/${courseId}/lesson/${l.lessonIndex ?? i}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{l.title}</div>
                  {Array.isArray(l.objectives) && <div style={{ fontSize: 12, color: '#666' }}>{l.objectives.join(' · ')}</div>}
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
