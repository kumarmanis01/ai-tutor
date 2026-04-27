/**
 * FILE OBJECTIVE:
 * - Admin API: patch a misconception by id.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/misconceptions/id.route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | fix: remove duplicate import and stray statement
 */

import { getServerSessionForHandlers } from '@/lib/session'
import { requireAdmin } from '@/auth/adminGuard'
import { prisma as dbClient } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { MisconceptionPatchSchema } from '@/lib/validators/misconception'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSessionForHandlers()
  try { requireAdmin(session) } catch { return new Response('Forbidden', { status: 403 }) }
  const id = params.id
  const raw = await req.json()

  const parsed = MisconceptionPatchSchema.safeParse(raw)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'invalid_payload', details: parsed.error.format() }), { status: 400 })
  }
  const body = parsed.data
  if (body.subjectId) {
    const s = await dbClient.subjectDef.findUnique({ where: { id: body.subjectId } })
    if (!s) return new Response(JSON.stringify({ error: 'invalid_subject' }), { status: 400 })
  }
  if (body.conceptId) {
    const c = await dbClient.concept.findUnique({ where: { id: body.conceptId } })
    if (!c) return new Response(JSON.stringify({ error: 'invalid_concept' }), { status: 400 })
  }
  const existing = await dbClient.misconception.findUnique({ where: { id } })
  if (!existing) return new Response('Not found', { status: 404 })

  const updated = await dbClient.misconception.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      correction: body.correction ?? existing.correction,
      triggerPatterns: body.triggerPatterns ?? existing.triggerPatterns,
      prevalenceRate: body.prevalenceRate ?? existing.prevalenceRate,
      subjectId: body.subjectId ?? existing.subjectId,
      conceptId: body.conceptId ?? existing.conceptId,
    },
  })

  // audit log
  try {
    await dbClient.auditLog.create({
      data: {
        adminId: session?.user?.id ?? null,
        targetEntity: 'Misconception',
        targetId: id,
        action: 'MISCONCEPTION_UPDATE',
        previousValue: existing as any,
        newValue: updated as any,
      },
    })
  } catch (e) {
    // fail-safe: don't block main update on audit write but record warning
    logger.warn('audit log failed', { error: e });
  }

  return new Response(JSON.stringify(updated), { status: 200 })
}
