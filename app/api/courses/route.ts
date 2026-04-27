import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = (global as any).__TEST_PRISMA__ ?? (await import('../../../lib/prisma')).prisma
  // Fetch all published packages ordered by syllabusId asc, version desc
  const rows = await db.coursePackage.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ syllabusId: 'asc' }, { version: 'desc' }],
  })

  // Reduce to latest per syllabusId
  const map = new Map<string, { syllabusId: string; latestVersion: number; title?: string }>()
  for (const r of rows) {
    if (!map.has(r.syllabusId)) {
      map.set(r.syllabusId, { syllabusId: r.syllabusId, latestVersion: r.version, title: (r.json as any)?.title })
    }
  }

  return NextResponse.json(Array.from(map.values()))
}

export default GET
