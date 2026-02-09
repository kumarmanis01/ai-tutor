

export async function GET(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma

  const { getServerSessionForHandlers } = await import('@/lib/session')
  const session = await getServerSessionForHandlers()
  const userId = session?.user?.id ?? null

  const row = await db.coursePackage.findFirst({ where: { syllabusId: courseId, status: 'PUBLISHED' }, orderBy: { version: 'desc' } })
  if (!row) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })

  const { hasLearnerAccess } = await import('../../../../../../../lib/guards/access')
  const allowed = await hasLearnerAccess(db, userId, courseId, session?.user?.tenantId ?? null)
  if (!allowed) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } })

  // Validate CoursePackage size to avoid expensive exports
  try {
    const { validatePackageSize } = await import('../../../../../../../lib/safety/validatePackageSize')
    const max = Number(process.env.MAX_COURSEPACKAGE_EXPORT_BYTES ?? 5_000_000)
    const { ok, size } = validatePackageSize(row.json || {}, max)
    if (!ok) {
      return new Response(JSON.stringify({ error: 'Course package too large to export', size, max }), { status: 413, headers: { 'Content-Type': 'application/json' } })
    }
  } catch {
    // allow export if size check cannot run
  }

  // Rate-limit exports per user+course
  try {
    const { allowExportRequest } = await import('../../../../../../../lib/rateLimit/exportLimiter')
    const { allowed: ok, retryAfter } = allowExportRequest(userId ?? null, courseId)
    if (!ok) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) } })
    }
  } catch {
    // continue if limiter fails
  }

  const { exportCourseToPDF } = await import('@/lib/exporters/pdf')
  const buf = await exportCourseToPDF(row.json)
  // Audit the export download (non-blocking)
  try {
    const { logAuditEvent } = await import('@/lib/audit/log')
    logAuditEvent(db, { actorId: userId ?? null, action: 'export_pdf', entityType: 'COURSE', entityId: courseId, metadata: { courseId, packageId: row.id, tenantId: (row as any)?.tenantId ?? null } })
  } catch {
    // swallow
  }

  const body = Uint8Array.from(buf)
  const title = (row.json as any)?.title ?? courseId
  const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${slug}.pdf"` } })
}

export default GET
