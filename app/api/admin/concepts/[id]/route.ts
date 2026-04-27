/**
 * PATCH /api/admin/concepts/[id]
 * F-ADM-002 AC-03: Admin update of concept IRT parameters and prerequisites.
 * Writes a ConceptHistory row for every accepted change so edits are auditable.
 *
 * Body: { irtB?: number, prerequisiteConceptIds?: string[], reason: string }
 * Returns: { ok: true, conceptId }
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: conceptId } = await context.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const reason = typeof (body as any)?.reason === 'string' ? ((body as any).reason as string).trim() : ''
  if (!reason) {
    return NextResponse.json({ error: 'reason_required' }, { status: 400 })
  }

  // At least one field must be changing
  const hasIrtB = (body as any)?.irtB !== undefined
  const hasPrereqs = (body as any)?.prerequisiteConceptIds !== undefined
  if (!hasIrtB && !hasPrereqs) {
    return NextResponse.json(
      { error: 'no_change', message: 'Provide irtB or prerequisiteConceptIds to update' },
      { status: 400 },
    )
  }

  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    select: { id: true, irt_b: true, prerequisiteConceptIds: true },
  })
  if (!concept) {
    return NextResponse.json({ error: 'concept_not_found' }, { status: 404 })
  }

  const newIrtB: number | undefined = hasIrtB ? Number((body as any).irtB) : undefined
  if (hasIrtB && !Number.isFinite(newIrtB!)) {
    return NextResponse.json({ error: 'irtB_invalid', message: 'irtB must be a finite number' }, { status: 400 })
  }

  const newPrereqs: string[] | undefined = hasPrereqs
    ? (Array.isArray((body as any).prerequisiteConceptIds) ? (body as any).prerequisiteConceptIds : [])
    : undefined

  const updateData: Record<string, unknown> = {}
  if (hasIrtB) updateData.irt_b = newIrtB
  if (hasPrereqs) updateData.prerequisiteConceptIds = newPrereqs

  await prisma.$transaction([
    prisma.concept.update({
      where: { id: conceptId },
      data: updateData,
    }),
    prisma.conceptHistory.create({
      data: {
        conceptId,
        adminId: session.user.id,
        reason,
        previousIrtB: hasIrtB ? concept.irt_b : null,
        newIrtB: hasIrtB ? newIrtB! : null,
        previousPrereqIds: hasPrereqs ? concept.prerequisiteConceptIds : [],
        newPrereqIds: hasPrereqs ? newPrereqs! : [],
      },
    }),
  ])

  logger.info('admin.concept.updated', {
    event: 'concept_updated',
    context: {
      conceptId,
      adminId: session.user.id,
      changedFields: Object.keys(updateData),
    },
  })

  return NextResponse.json({ ok: true, conceptId })
}
