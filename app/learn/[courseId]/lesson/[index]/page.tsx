/**
 * FILE OBJECTIVE:
 * - Display a single lesson/chapter content with navigation.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/learn/courseId/lesson/index/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | fixed server-side fetch with headers() for base URL
 */
import Link from 'next/link'
import { headers } from 'next/headers'

type Props = { params: { courseId: string; index: string } }

interface Lesson {
  id?: string;
  lessonIndex?: number;
  title: string;
  slug?: string;
  objectives?: string[];
  explanation?: {
    overview?: string;
    concepts?: Array<{ title: string; explanation: string }>;
  };
}

interface CoursePackage {
  modules?: Array<{
    lessons?: Lesson[];
  }>;
}

function flattenLessons(pkg: CoursePackage | null): Lesson[] {
  const lessons: Lesson[] = []
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
  
  // Use headers() for server-side fetch
  const headersList = headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || 'http'
  const baseUrl = `${protocol}://${host}`
  
  let lesson: Lesson | null = null
  let pkg: CoursePackage | null = null
  
  try {
    const res = await fetch(`${baseUrl}/api/learn/courses/${courseId}/lessons/${index}`, { cache: 'no-store' })
    if (res.ok) {
      lesson = await res.json()
    }
  } catch (e) {
    // Silently fail
  }
  
  if (!lesson) {
    return (
      <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
        <Link href={`/learn/${courseId}`} style={{ fontSize: 14, color: '#0070f3' }}>← Back to course</Link>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📖</div>
          <h1 style={{ fontSize: 20 }}>Content not available</h1>
          <p style={{ color: '#666' }}>This lesson content is being prepared. Check back soon!</p>
        </div>
      </div>
    )
  }

  // For navigation we need the full package to compute previous/next
  try {
    const pkgRes = await fetch(`${baseUrl}/api/learn/courses/${courseId}`, { cache: 'no-store' })
    if (pkgRes.ok) {
      pkg = await pkgRes.json()
    }
  } catch (e) {
    // Silently fail
  }
  
  const lessons = flattenLessons(pkg)
  const idx = lessons.findIndex((l: Lesson) => Number(l.lessonIndex) === Number(index) || (l.id && l.id === lesson?.id))

  const prev = idx > 0 ? lessons[idx - 1] : null
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null

  return (
    <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
      <Link href={`/learn/${courseId}`} style={{ fontSize: 14, color: '#0070f3' }}>← Back to course</Link>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginTop: 12 }}>{lesson.title}</h1>
      
      {Array.isArray(lesson.objectives) && lesson.objectives.length > 0 && (
        <div style={{ marginTop: 16, padding: 16, background: '#f0f7ff', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>📚 Learning Objectives</div>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {lesson.objectives.map((o: string, i: number) => <li key={i} style={{ color: '#444', marginBottom: 4 }}>{o}</li>)}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {lesson.explanation?.overview && (
          <p style={{ lineHeight: 1.7, fontSize: 15 }}>{lesson.explanation.overview}</p>
        )}
        {Array.isArray(lesson.explanation?.concepts) && lesson.explanation.concepts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {lesson.explanation.concepts.map((c, i: number) => (
              <div key={i} style={{ marginBottom: 16, padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{c.title}</div>
                <div style={{ color: '#333', lineHeight: 1.6 }}>{c.explanation}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        {prev ? (
          <Link href={`/learn/${courseId}/lesson/${prev.lessonIndex ?? lessons.indexOf(prev)}`} style={{ padding: '10px 16px', background: '#f0f0f0', borderRadius: 8, textDecoration: 'none', color: '#333' }}>
            ← Previous
          </Link>
        ) : <div />}
        {next ? (
          <Link href={`/learn/${courseId}/lesson/${next.lessonIndex ?? lessons.indexOf(next)}`} style={{ padding: '10px 16px', background: '#0070f3', color: '#fff', borderRadius: 8, textDecoration: 'none' }}>
            Next →
          </Link>
        ) : <div />}
      </div>
    </div>
  )
}
