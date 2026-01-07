import type { PrismaClient } from '@prisma/client'
import logAuditEvent from '@/lib/audit/log'

export type SuggestionRecordInput = {
  courseId: string
  scope: 'COURSE' | 'MODULE' | 'LESSON' | 'QUIZ'
  targetId: string
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  message: string
  evidenceJson: any
  sourceSignalId?: string
}

export async function saveSuggestions(db: PrismaClient, suggestions: SuggestionRecordInput[], actorId?: string) {
  if (!suggestions || suggestions.length === 0) return []
  const created: any[] = []
  for (const s of suggestions) {
    try {
      // Idempotency: if sourceSignalId is provided, skip if a suggestion with same
      // (sourceSignalId, type, targetId) already exists (enforced by DB unique constraint).
      if (s.sourceSignalId) {
        const exists = await (db as any).contentSuggestion.findUnique({ where: { sourceSignalId_type_targetId: { sourceSignalId: s.sourceSignalId, type: s.type, targetId: s.targetId } } })
        if (exists) {
          continue
        }
      }

      const row = await (db as any).contentSuggestion.create({
        data: {
          courseId: s.courseId,
          scope: s.scope,
          targetId: s.targetId,
          type: s.type as any,
          severity: s.severity as any,
          message: s.message,
          evidenceJson: s.evidenceJson,
          sourceSignalId: s.sourceSignalId ?? null,
        }
      })
      created.push(row)
      // non-blocking audit
      try {
        logAuditEvent(db, {
          actorId: actorId ?? null,
          action: 'SUGGESTION_CREATED',
          entityType: 'ContentSuggestion',
          entityId: row.id,
          metadata: { courseId: s.courseId, type: s.type }
        })
      } catch {}
    } catch {
      // continue on error — generation is best-effort
    }
  }
  return created
}

export async function listSuggestions(db: PrismaClient, filters: { courseId?: string, scope?: string, status?: string } = {}) {
  const where: any = {}
  if (filters.courseId) where.courseId = filters.courseId
  if (filters.scope) where.scope = filters.scope
  if (filters.status) where.status = filters.status
  const rows = await (db as any).contentSuggestion.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100
  })
  return rows
}

export async function updateSuggestionStatus(db: PrismaClient, id: string, status: 'ACCEPTED' | 'DISMISSED', actorId?: string) {
  const allowed = ['ACCEPTED', 'DISMISSED']
  if (!allowed.includes(status)) throw new Error('Invalid status')
  const existing = await (db as any).contentSuggestion.findUnique({ where: { id } })
  if (!existing) return null
  const updated = await (db as any).contentSuggestion.update({ where: { id }, data: { status: status as any } })
  try {
    logAuditEvent(db, {
      actorId: actorId ?? null,
      action: status === 'ACCEPTED' ? 'SUGGESTION_ACCEPTED' : 'SUGGESTION_DISMISSED',
      entityType: 'ContentSuggestion',
      entityId: id,
      metadata: { courseId: existing.courseId, status }
    })
  } catch {}
  return updated
}

export const suggestionStore = { saveSuggestions, listSuggestions, updateSuggestionStatus }
export default suggestionStore
