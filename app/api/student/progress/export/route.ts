import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { computeReadinessScore } from '@/lib/student/examReadiness'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const start = Date.now()
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

    // For each subject, compute readiness (best-effort)
    const readinessRows: Array<{ subject: string; score: number }> = []
    if (subjectNames.length > 0) {
      const subjectDefs = await prisma.subjectDef.findMany({ where: { OR: [{ name: { in: subjectNames } }, { slug: { in: subjectNames } }], lifecycle: 'active' }, select: { id: true, name: true } })
      for (const sd of subjectDefs) {
        try {
          const r = await computeReadinessScore(userId, sd.id)
          readinessRows.push({ subject: sd.name, score: Math.round(r.score) })
        } catch {
          // skip
        }
      }
    }

    // Build a small narrative fallback
    const narrative = `Keep going! You completed ${sessionCount} session${sessionCount === 1 ? '' : 's'} in the last 30 days. Your current subject readiness: ${readinessRows.map(r => `${r.subject} ${r.score}%`).join('; ') || 'N/A'}.`;

    // Generate PDF
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const page = doc.addPage([595, 842])
    const margin = 40
    let y = page.getHeight() - margin

    page.drawText("Progress Report", { x: margin, y, size: 18, font })
    y -= 28
    page.drawText(`Student: ${userProfile?.name ?? 'Student'}`, { x: margin, y, size: 12, font })
    y -= 18
    page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: margin, y, size: 12, font })
    y -= 22

    page.drawText("Teacher Vidya's insight:", { x: margin, y, size: 12, font })
    y -= 16
    const narrativeLines = splitText(narrative, 90)
    for (const line of narrativeLines) {
      page.drawText(line, { x: margin, y, size: 11, font })
      y -= 14
    }
    y -= 8

    page.drawText('30-day summary:', { x: margin, y, size: 12, font })
    y -= 16
    page.drawText(`- Sessions in last 30 days: ${sessionCount}`, { x: margin + 8, y, size: 11, font })
    y -= 14

    if (readinessRows.length > 0) {
      page.drawText('- Subject readiness:', { x: margin + 8, y, size: 11, font })
      y -= 14
      for (const r of readinessRows) {
        page.drawText(`  • ${r.subject}: ${r.score}%`, { x: margin + 14, y, size: 10, font })
        y -= 12
      }
    }

    const pdfBytes = await doc.save()

    // Audit export (best-effort)
    try {
      const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma
      const { logAuditEvent } = await import('@/lib/audit/log')
      logAuditEvent(db, { actorId: userId, action: 'export_progress_pdf', entityType: 'PROGRESS_REPORT', entityId: userId })
    } catch {
      // swallow
    }

    return new NextResponse(Buffer.from(pdfBytes), {
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

function splitText(text: string, maxChars = 90) {
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
