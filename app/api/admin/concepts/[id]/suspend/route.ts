import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { AdminActionType } from '@prisma/client'

/**
 * POST /api/admin/concepts/:id/suspend
 *
 * F-ADM-013 AC-04: When a hallucination is confirmed in a curriculum explanation,
 * admin suspends the concept from AI teaching until the curriculum chunk is fixed.
 * Suspended concepts return CONCEPT_SUSPENDED at session start so students see a
 * "this topic is being reviewed" message rather than a live AI response.
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
      { error: 'reason_required', message: 'reason is required when suspending a concept' },
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
  if (concept.isSuspended) {
    return NextResponse.json(
      { error: 'already_suspended', message: 'Concept is already suspended' },
      { status: 409 },
    )
  }

  const now = new Date()
  await prisma.$transaction([
    prisma.concept.update({
      where: { id },
      data: {
        isSuspended: true,
        suspendedAt: now,
        suspendedReason: reason,
      },
    }),
    prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'Concept',
        targetId: id,
        action: (AdminActionType?.CONCEPT_SUSPEND) ?? 'CONCEPT_SUSPEND',
        previousValue: { isSuspended: false },
        newValue: { isSuspended: true, suspendedAt: now.toISOString() },
        reason,
      },
    }),
  ])

  return NextResponse.json({ ok: true, conceptId: id })
}
