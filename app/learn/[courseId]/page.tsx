/**
 * FILE OBJECTIVE:
 * - Display a single course/subject with its chapters/lessons.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/learn/courseId/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | enhanced to display subjects with chapters from SubjectDef
 * - 2026-01-22 | copilot | fixed server-side fetch with headers() for base URL
 */
import Link from 'next/link'
import { headers } from 'next/headers'

type Props = { params: { courseId: string } }

interface Lesson {
  id: string;
  lessonIndex?: number;
  title: string;
  slug?: string;
  objectives?: string[];
}

interface CourseData {
  type?: 'subject' | 'course';
  id?: string;
  title?: string;
  description?: string;
  modules?: Array<{
    id: string;
    title: string;
    lessons: Lesson[];
  }>;
}

function flattenLessons(pkg: CourseData | null): Lesson[] {
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
  const { courseId } = params
  
  // Use relative URL with proper host header for server-side fetch
  const headersList = headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || 'http'
  const baseUrl = `${protocol}://${host}`
  
  let pkg: CourseData | null = null
  try {
    const res = await fetch(`${baseUrl}/api/learn/courses/${courseId}`, { cache: 'no-store' })
    if (res.ok) {
      pkg = await res.json()
    }
  } catch (e) {
    // Silently fail
  }
  
  if (!pkg) {
    return (
      <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
        <Link href="/learn" style={{ fontSize: 14, color: '#0070f3', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          ← Back to courses
        </Link>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h1 style={{ marginTop: 8, fontSize: 20 }}>Course not found</h1>
          <p style={{ color: '#666' }}>This course may not be available yet.</p>
        </div>
      </div>
    )
  }
  
  const lessons = flattenLessons(pkg)
  const isSubject = pkg.type === 'subject'

  return (
    <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
      <Link href="/learn" style={{ fontSize: 14, color: '#0070f3', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        ← Back to courses
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginTop: 12 }}>{pkg.title ?? courseId}</h1>
      {pkg.description && <p style={{ color: '#666', marginTop: 8 }}>{pkg.description}</p>}

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>
        {isSubject ? '📚 Chapters' : '📖 Lessons'}
      </h2>
      
      {lessons.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', background: '#f9f9f9', borderRadius: 8 }}>
          <p style={{ color: '#666' }}>No content available yet.</p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {lessons.map((l: Lesson, i: number) => (
            <li key={l.id ?? i} style={{ marginBottom: 8 }}>
              <Link 
                href={`/learn/${courseId}/lesson/${l.lessonIndex ?? i}`} 
                style={{ 
                  textDecoration: 'none', 
                  color: 'inherit',
                  display: 'block',
                  padding: 16,
                  background: '#fff',
                  borderRadius: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'box-shadow 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{l.title}</div>
                    {Array.isArray(l.objectives) && l.objectives.length > 0 && (
                      <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                        {l.objectives.slice(0, 2).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div style={{ 
                    fontSize: 13, 
                    color: '#0070f3',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    Start →
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
