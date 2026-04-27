/**
 * FILE OBJECTIVE:
 * - Display a single lesson/chapter content with navigation and progress tracking.
 *   Server component that fetches data and renders LessonViewClient.
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
 * - 2026-02-04 | claude | integrated LessonViewClient for progress tracking, auth required
 */
import Link from 'next/link'
import { headers } from 'next/headers'
import LessonViewClient, { LessonData } from '@/components/Learn/LessonViewClient'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ courseId: string; index: string }> }

interface CoursePackage {
  modules?: Array<{
    lessons?: LessonData[];
  }>;
}

function flattenLessons(pkg: CoursePackage | null): LessonData[] {
  const lessons: LessonData[] = []
  if (!pkg || !Array.isArray(pkg.modules)) return lessons
  for (const m of pkg.modules) {
    if (Array.isArray(m.lessons)) {
      for (const l of m.lessons) lessons.push(l)
    }
  }
  return lessons
}

export default async function Page({ params }: Props) {
  const { courseId, index } = await params

  // Use headers() for server-side fetch
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || 'http'
  const baseUrl = `${protocol}://${host}`
  
  let lesson: LessonData | null = null
  let pkg: CoursePackage | null = null
  
  try {
    const res = await fetch(`${baseUrl}/api/learn/courses/${courseId}/lessons/${index}`, { cache: 'no-store' })
    if (res.ok) {
      lesson = await res.json()
    }
  } catch {
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
  } catch {
    // Silently fail
  }
  
  const lessons = flattenLessons(pkg)
  const idx = lessons.findIndex((l) => Number(l.lessonIndex) === Number(index) || (l.id && l.id === lesson?.id))

  const prev = idx > 0 ? lessons[idx - 1] : null
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null

  return (
    <LessonViewClient
      courseId={courseId}
      lessonIndex={index}
      lesson={lesson}
      prev={prev ? { lessonIndex: prev.lessonIndex, id: prev.id } : null}
      next={next ? { lessonIndex: next.lessonIndex, id: next.id } : null}
      totalLessons={lessons.length}
    />
  )
}
