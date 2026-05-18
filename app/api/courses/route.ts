import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = (global as any).__TEST_PRISMA__ ?? (await import('../../../lib/prisma')).prisma
    const rows = await db.coursePackage.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ syllabusId: 'asc' }, { version: 'desc' }],
    })

    const map = new Map<string, { syllabusId: string; latestVersion: number; title?: string }>()
    for (const r of rows) {
      if (!map.has(r.syllabusId)) {
        map.set(r.syllabusId, { syllabusId: r.syllabusId, latestVersion: r.version, title: (r.json as any)?.title })
      }
    }

    return NextResponse.json(Array.from(map.values()))
  } catch (err) {
    const { logger } = await import('../../../lib/logger')
    logger.error('courses.GET.error', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Failed to load courses' }, { status: 500 })
  }
}

export default GET
