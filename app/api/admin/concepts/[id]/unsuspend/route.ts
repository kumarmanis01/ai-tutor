import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { AdminActionType } from '@prisma/client'

/**
 * POST /api/admin/concepts/:id/unsuspend
 *
 * F-ADM-013 AC-04: Lifts an admin suspension on a concept once the curriculum
 * chunk has been fixed and the hallucination issue is resolved.
 *
 * Body: { reason: string }
 * Returns: { ok: true, conceptId: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const reason: string = typeof (body as any)?.reason === 'string' ? String((body as any).reason).trim() : ''
  if (!reason) {
    return NextResponse.json(
      { error: 'reason_required', message: 'reason is required when lifting a concept suspension' },
      { status: 400 },
    )
  }

  const concept = await prisma.concept.findUnique({
    where: { id },
    select: { id: true, name: true, isSuspended: true },
  })
  if (!concept) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!concept.isSuspended) {
    return NextResponse.json(
      { error: 'not_suspended', message: 'Concept is not currently suspended' },
      { status: 409 },
    )
  }

  await prisma.$transaction([
    prisma.concept.update({
      where: { id },
      data: {
        isSuspended: false,
        suspendedAt: null,
        suspendedReason: null,
      },
    }),
    prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'Concept',
        targetId: id,
        action: (AdminActionType?.CONCEPT_UNSUSPEND) ?? 'CONCEPT_UNSUSPEND',
        previousValue: { isSuspended: true },
        newValue: { isSuspended: false },
        reason,
      },
    }),
  ])

  return NextResponse.json({ ok: true, conceptId: id })
}
