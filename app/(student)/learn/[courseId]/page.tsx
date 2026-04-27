/**
 * FILE OBJECTIVE:
 * - Display a single course/subject with its chapters/lessons.
 *   Server component that fetches data and renders LessonListClient.
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
 * - 2026-02-04 | claude | integrated LessonListClient for progress tracking, auth required
 */
import Link from 'next/link'
import { headers } from 'next/headers'
import LessonListClient, { Lesson } from '@/components/Learn/LessonListClient'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ courseId: string }> }

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
  const { courseId } = await params

  // Use relative URL with proper host header for server-side fetch
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || 'http'
  const baseUrl = `${protocol}://${host}`
  
  let pkg: CourseData | null = null
  try {
    const res = await fetch(`${baseUrl}/api/learn/courses/${courseId}`, { cache: 'no-store' })
    if (res.ok) {
      pkg = await res.json()
    }
  } catch {
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
    <LessonListClient
      courseId={courseId}
      courseTitle={pkg.title ?? courseId}
      courseDescription={pkg.description}
      lessons={lessons}
      isSubject={isSubject}
    />
  )
}
