import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { logAuditEvent } from '@/lib/audit/log'

export async function POST(req: Request) {
  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma
  const body = await req.json()
  const { courseId } = body || {}

  const session = await getServerSessionForHandlers()
  const userId = session?.user?.id
  if (!userId || !courseId) return NextResponse.json({ error: 'Missing fields or unauthorized' }, { status: 400 })

  // Ensure course is published
  const pkg = await db.coursePackage.findFirst({ where: { syllabusId: courseId, status: 'PUBLISHED' } })
  if (!pkg) return NextResponse.json({ error: 'Course not found or not published' }, { status: 404 })
  // If course is monetized (has active product), require purchase
  const prod = await db.product.findFirst({ where: { courseId, active: true } })
  if (prod) {
    const purchase = await db.purchase.findFirst({ where: { userId, productId: prod.id } })
    if (!purchase) return NextResponse.json({ error: 'Purchase required' }, { status: 403 })
  }

  const created = await db.enrollment.create({ data: { userId, courseId } })
  // Audit the enrollment (non-blocking)
  logAuditEvent(db, { actorId: userId, action: 'enrollment_create', entityType: 'COURSE', entityId: courseId, metadata: { enrollmentId: created.id, courseId } })

  return NextResponse.json({ ok: true, enrollment: created }, { status: 201 })
}

export default POST
