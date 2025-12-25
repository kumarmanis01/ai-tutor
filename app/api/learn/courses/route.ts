import { NextResponse } from 'next/server'

export async function GET() {
  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma

  const rows = await db.coursePackage.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ syllabusId: 'asc' }, { version: 'desc' }]
  })

  const map = new Map<string, { courseId: string; title?: string; version: number }>()
  for (const r of rows) {
    if (!map.has(r.syllabusId)) {
      map.set(r.syllabusId, { courseId: r.syllabusId, title: (r.json as any)?.title, version: r.version })
    }
  }

  return NextResponse.json(Array.from(map.values()))
}

export default GET
