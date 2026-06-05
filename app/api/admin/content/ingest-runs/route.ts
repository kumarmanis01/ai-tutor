/**
 * GET /api/admin/content/ingest-runs
 *
 * Returns the last 10 IngestRunLog entries with resolved subject name and grade.
 * Auth: admin role required.
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  const runs = await prisma.ingestRunLog.findMany({
    orderBy: { runAt: 'desc' },
    take: 10,
  })

  // Resolve subject names from subjectIds (batch lookup)
  const subjectIds = runs.map((r: any ) => r.subjectId).filter(Boolean) as string[]
  const subjects = subjectIds.length
    ? await prisma.subjectDef.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, name: true, class: { select: { grade: true } } },
      })
    : []

  const subjectMap = new Map<string, any>(subjects.map((s: any) => [s.id, s]))

  const enriched = runs.map((r: any ) => {
    const subject = r.subjectId ? subjectMap.get(r.subjectId) : null
    return {
      id: r.id,
      runAt: r.runAt.toISOString(),
      subjectId: r.subjectId ?? null,
      subjectName: subject?.name ?? r.board ?? 'Unknown',
      grade: subject?.class.grade ?? null,
      fileSource: r.fileSource ?? null,
      chunksCreated: r.chunksCreated,
      chunksUpdated: r.chunksUpdated,
      embeddingsGenerated: r.embeddingsGenerated,
      errors: r.errors,
      durationMs: r.durationMs ?? null,
    }
  })

  return NextResponse.json({ runs: enriched })
}
