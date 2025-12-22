export async function GET(req: Request, { params }: { params: { courseId: string } }) {
  const { courseId } = params
  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma

  const { getServerSessionForHandlers } = await import('@/lib/session')
  const session = await getServerSessionForHandlers()
  const userId = session?.user?.id ?? null

  const row = await db.coursePackage.findFirst({ where: { syllabusId: courseId, status: 'PUBLISHED' }, orderBy: { version: 'desc' } })
  if (!row) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })

  const { hasLearnerAccess } = await import('../../../../../../../lib/guards/access')
  const allowed = await hasLearnerAccess(db, userId, courseId)
  if (!allowed) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } })

  const { exportCourseToLMS } = await import('@/lib/exporters/lms')
  const buf = exportCourseToLMS(row.json)
  const body = Uint8Array.from(buf)
  const title = (row.json as any)?.title ?? courseId
  const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${slug}.zip"` } })
}

export default GET
