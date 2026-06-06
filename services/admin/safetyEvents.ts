/**
 * FILE OBJECTIVE:
 * - Read-side service for admin safety-event dashboards: list unresolved events
 *   (severity-ranked) and paginated event history with resolution metadata.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/admin/safetyEvents.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-06T00:00:00Z | claude | add SafetyEventRow type for typed sort/map callbacks; add standard header
 */

import { prisma } from '@/lib/prisma'

type SafetyEventRow = {
  id: string
  triggerType: string
  sessionId: string | null
  turnId: string | null
  studentId: string
  severity: string | null
  inputPreview: string | null
  createdAt: Date
  resolvedAt: Date | null
  resolution: string | null
}

export type SafetyEventView = {
  id: string
  triggerType: string
  sessionId: string | null
  turnId: string | null
  studentId: string
  severity: string
  inputPreview: string | null
  createdAt: string
  resolvedAt: string | null
  resolution: string | null
}

const severityRank: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
}

export async function listUnresolvedSafetyEvents(opts?: { limit?: number }): Promise<SafetyEventView[]> {
  const limit = Math.min(Math.max(Number(opts?.limit ?? 200), 1), 1000)

  const rows = await prisma.safetyEvent.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      triggerType: true,
      sessionId: true,
      turnId: true,
      studentId: true,
      severity: true,
      inputPreview: true,
      createdAt: true,
      resolvedAt: true,
      resolution: true,
    },
  })

  rows.sort((a: SafetyEventRow, b: SafetyEventRow) => {
    const ar = severityRank[String(a.severity ?? '').toUpperCase()] ?? 0
    const br = severityRank[String(b.severity ?? '').toUpperCase()] ?? 0
    if (ar !== br) return br - ar
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  return rows.map((r: SafetyEventRow) => ({
    id: r.id,
    triggerType: r.triggerType,
    sessionId: r.sessionId ?? null,
    turnId: r.turnId ?? null,
    studentId: r.studentId,
    severity: r.severity ?? 'UNKNOWN',
    inputPreview: r.inputPreview ?? null,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    resolution: r.resolution ?? null,
  }))
}

export async function listSafetyEvents(opts: {
  page: number
  limit: number
  category?: string
  severity?: string
  studentId?: string
  from?: Date
  to?: Date
  resolved?: boolean
}): Promise<{ events: SafetyEventView[]; total: number }> {
  const page = Math.max(1, Math.floor(opts.page))
  const limit = Math.min(Math.max(Math.floor(opts.limit), 1), 100)
  const skip = (page - 1) * limit

  const where: any = {}
  if (opts.category) where.triggerType = String(opts.category)
  if (opts.severity) where.severity = String(opts.severity)
  if (opts.studentId) where.studentId = String(opts.studentId)
  if (opts.resolved === true) where.resolvedAt = { not: null }
  if (opts.resolved === false) where.resolvedAt = null
  if (opts.from || opts.to) {
    where.createdAt = {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    }
  }

  const [rows, total] = await Promise.all([
    prisma.safetyEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        triggerType: true,
        sessionId: true,
        turnId: true,
        studentId: true,
        severity: true,
        inputPreview: true,
        createdAt: true,
        resolvedAt: true,
        resolution: true,
      },
    }),
    prisma.safetyEvent.count({ where }),
  ])

  return {
    total,
    events: rows.map((r: SafetyEventRow) => ({
      id: r.id,
      triggerType: r.triggerType,
      sessionId: r.sessionId ?? null,
      turnId: r.turnId ?? null,
      studentId: r.studentId,
      severity: r.severity,
      inputPreview: r.inputPreview ?? null,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      resolution: r.resolution ?? null,
    })),
  }
}

export async function setSafetyEventResolved(opts: { id: string; resolved: boolean }): Promise<void> {
  const resolvedAt = opts.resolved ? new Date() : null
  await prisma.safetyEvent.update({
    where: { id: opts.id },
    data: { resolvedAt },
  })
}

