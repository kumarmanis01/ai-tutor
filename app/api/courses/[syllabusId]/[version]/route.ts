import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { syllabusId: string; version: string } }) {
  const db = (global as any).__TEST_PRISMA__ ?? (await import('../../../../../lib/prisma')).prisma
  const { syllabusId, version } = params
  const v = Number(version)
  if (Number.isNaN(v)) return NextResponse.json({ error: 'Invalid version' }, { status: 400 })

  const row = await db.coursePackage.findUnique({
    where: { syllabusId_version: { syllabusId, version: v } }
  })

  if (!row || row.status !== 'PUBLISHED') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(row.json)
}

export default GET
