import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { syllabusId: string } }) {
  const db = (global as any).__TEST_PRISMA__ ?? (await import('../../../../lib/prisma')).prisma
  const { syllabusId } = params
  const rows = await db.coursePackage.findMany({
    where: { syllabusId, status: 'PUBLISHED' },
    orderBy: { version: 'desc' },
    select: { version: true }
  })

  const versions = rows.map((r: any) => r.version)
  if (versions.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ syllabusId, versions })
}

export default GET
