/**
 * FILE OBJECTIVE:
 * - Display available subjects/courses for learning with chapters.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/learn/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | refactored to display subjects with chapters from SubjectDef
 * - 2026-01-22 | copilot | fixed server-side fetch with headers() for base URL
 */
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface CourseItem {
  courseId: string;
  title?: string;
  version?: number;
  chapterCount?: number;
  type: 'course' | 'subject';
}

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const subjectFilter = typeof params.subject === 'string' ? params.subject : undefined

  // Use relative URL with proper host header for server-side fetch
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || 'http'
  const baseUrl = `${protocol}://${host}`

  let data: CourseItem[] = []
  try {
    const res = await fetch(`${baseUrl}/api/learn/courses`, { cache: 'no-store' })
    if (res.ok) {
      data = await res.json()
    }
  } catch {
    // Silently fail - show empty courses list
  }

  // If a subject filter was passed (e.g. from dashboard notes tab), redirect
  // to that subject's course page directly.
  if (subjectFilter && data.length > 0) {
    const match = data.find(
      (c) => c.title?.toLowerCase() === subjectFilter.toLowerCase()
    )
    if (match) {
      redirect(`/learn/${match.courseId}`)
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>📚 Learn</h1>
      {!Array.isArray(data) || data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📖</div>
          <p style={{ color: '#666', marginBottom: 8 }}>No courses available yet.</p>
          <p style={{ color: '#999', fontSize: 14 }}>Check back soon for new learning content!</p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {data.map((c: CourseItem) => (
            <li key={c.courseId} style={{ marginBottom: 12, borderRadius: 12, padding: 16, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <Link href={`/learn/${c.courseId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{c.title ?? c.courseId}</div>
                    <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                      {c.type === 'course' 
                        ? `Version ${c.version}` 
                        : `${c.chapterCount || 0} chapters`}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: 13, 
                    color: '#fff', 
                    background: '#0070f3', 
                    padding: '6px 12px', 
                    borderRadius: 6,
                    fontWeight: 500
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
