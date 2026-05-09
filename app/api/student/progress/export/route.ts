/**
 * FILE OBJECTIVE:
 * - Expose GET /api/student/progress/export to generate a student progress PDF.
 * - Aggregates recent progress signals and returns a downloadable PDF response.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/student/progress/export.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T09:00:00Z | copilot | added mandatory file header to close Gap 8 in progress-page audit
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { exportProgressReportToPDF } from '@/lib/exporters/pdf'
import { computeReadinessScore } from '@/lib/student/examReadiness'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request) {
  try {
    const session = await getServerSessionForHandlers()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Basic stats
    const [sessionCount, userProfile] = await Promise.all([
      prisma.structuredSession.count({ where: { studentId: userId, startedAt: { gte: thirtyDaysAgo } } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, subjects: true } }),
    ])

    const subjectNames = (userProfile?.subjects ?? []).map((s) => String(s)).filter(Boolean)

    // For each subject, compute readiness in parallel (best-effort)
    const readinessRows: Array<{ subject: string; score: number }> = []
    if (subjectNames.length > 0) {
      const subjectDefs = await prisma.subjectDef.findMany({ where: { OR: [{ name: { in: subjectNames } }, { slug: { in: subjectNames } }], lifecycle: 'active' }, select: { id: true, name: true } })
      const results = await Promise.allSettled(
        subjectDefs.map((sd) => computeReadinessScore(userId, sd.id))
      )
      for (let i = 0; i < subjectDefs.length; i++) {
        const r = results[i]
        if (r.status === 'fulfilled') {
          readinessRows.push({ subject: subjectDefs[i].name, score: Math.round(r.value.score) })
        }
      }
    }

    // Build a small narrative fallback
    const narrative = `Keep going! You completed ${sessionCount} session${sessionCount === 1 ? '' : 's'} in the last 30 days. Your current subject readiness: ${readinessRows.map(r => `${r.subject} ${r.score}%`).join('; ') || 'N/A'}.`;

    // Generate PDF using shared exporter
    const pdfBuffer = await exportProgressReportToPDF({
      studentName: userProfile?.name ?? 'Student',
      date: new Date().toLocaleDateString(),
      narrative,
      sessionCount,
      readinessRows,
    })

    // Audit export (best-effort)
    try {
      const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma
      const { logAuditEvent } = await import('@/lib/audit/log')
      logAuditEvent(db, { actorId: userId, action: 'export_progress_pdf', entityType: 'PROGRESS_REPORT', entityId: userId })
    } catch (err) {
      logger.debug('Audit logging failed for progress export', { error: String(err) })
    }

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="progress-report.pdf"`,
      },
    })
  } catch (err) {
    logger.error('progress export failed', { error: String(err) })
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

function _splitText(text: string, maxChars = 90) {
  if (!text) return []
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      lines.push(cur.trim())
      cur = w
    } else {
      cur = (cur + ' ' + w).trim()
    }
  }
  if (cur) lines.push(cur.trim())
  return lines
}
