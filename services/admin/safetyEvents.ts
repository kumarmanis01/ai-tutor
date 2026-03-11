import { prisma } from '@/lib/prisma'

export type SafetyEventView = {
  id: string
  triggerType: string
  sessionId: string | null
  turnId: string | null
  studentId: string
  severity: string
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
      createdAt: true,
      resolvedAt: true,
      resolution: true,
    },
  })

  rows.sort((a, b) => {
    const ar = severityRank[String(a.severity ?? '').toUpperCase()] ?? 0
    const br = severityRank[String(b.severity ?? '').toUpperCase()] ?? 0
    if (ar !== br) return br - ar
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  return rows.map((r) => ({
    id: r.id,
    triggerType: r.triggerType,
    sessionId: r.sessionId ?? null,
    turnId: r.turnId ?? null,
    studentId: r.studentId,
    severity: r.severity,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    resolution: r.resolution ?? null,
  }))
}

