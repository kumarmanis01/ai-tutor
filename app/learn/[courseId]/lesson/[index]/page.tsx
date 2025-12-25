import Link from 'next/link'

type Props = { params: { courseId: string; index: string } }

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
  const { courseId, index } = params
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/learn/courses/${courseId}/lessons/${index}`, { cache: 'no-store' })
  if (!res.ok) return (<div style={{ padding: 16 }}><h1>Lesson not found</h1></div>)
  const lesson = await res.json()

  // For navigation we need the full package to compute previous/next
  const pkgRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/learn/courses/${courseId}`, { cache: 'no-store' })
  const pkg = pkgRes.ok ? await pkgRes.json() : null
  const lessons = flattenLessons(pkg)
  const idx = lessons.findIndex((l: any) => Number(l.lessonIndex) === Number(index) || (l.id && l.id === lesson.id))

  const prev = idx > 0 ? lessons[idx - 1] : null
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null

  return (
    <div style={{ padding: 16 }}>
      <Link href={`/learn/${courseId}`} style={{ fontSize: 13, color: '#0070f3' }}>← Back to course</Link>
      <h1 style={{ fontSize: 20, marginTop: 8 }}>{lesson.title}</h1>
      {Array.isArray(lesson.objectives) && (
        <ul style={{ paddingLeft: 20 }}>
          {lesson.objectives.map((o: string, i: number) => <li key={i} style={{ color: '#444' }}>{o}</li>)}
        </ul>
      )}

      <div style={{ marginTop: 12 }}>
        {lesson.explanation?.overview && <p style={{ lineHeight: 1.6 }}>{lesson.explanation.overview}</p>}
        {Array.isArray(lesson.explanation?.concepts) && (
          <div style={{ marginTop: 8 }}>
            {lesson.explanation.concepts.map((c: any, i: number) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>{c.title}</div>
                <div style={{ color: '#333' }}>{c.explanation}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        {prev ? <Link href={`/learn/${courseId}/lesson/${prev.lessonIndex ?? lessons.indexOf(prev)}`} style={{ padding: '8px 12px', background: '#f0f0f0', borderRadius: 6 }}>← Previous</Link> : <div />}
        {next ? <Link href={`/learn/${courseId}/lesson/${next.lessonIndex ?? lessons.indexOf(next)}`} style={{ padding: '8px 12px', background: '#0070f3', color: '#fff', borderRadius: 6 }}>Next →</Link> : <div />}
      </div>
    </div>
  )
}
