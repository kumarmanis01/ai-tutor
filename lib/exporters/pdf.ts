/**
 * FILE OBJECTIVE:
 * - Provide PDF exporter utilities for course and progress report exports.
 *
 * LINKED UNIT TEST:
 * - __tests__/lib/exporters/pdf.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | added exportProgressReportToPDF and file header
 */

import { PDFDocument, StandardFonts } from 'pdf-lib'

export async function exportCourseToPDF(coursePackage: any): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pageSize = { width: 612, height: 792 }

  const lessons: any[] = []
  if (Array.isArray(coursePackage?.modules)) {
    for (const m of coursePackage.modules) {
      if (Array.isArray(m.lessons)) {
        for (const l of m.lessons) lessons.push(l)
      }
    }
  }

  // If no lessons, still create a title page
  if (lessons.length === 0) {
    const page = doc.addPage([pageSize.width, pageSize.height])
    page.drawText(coursePackage?.title ?? 'Course', { x: 50, y: pageSize.height - 80, size: 20, font })
  }

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i]
    const page = doc.addPage([pageSize.width, pageSize.height])
    const margin = 50
    let y = pageSize.height - margin

    // Title
    const title = lesson.title ?? `Lesson ${i + 1}`
    page.drawText(title, { x: margin, y: y - 0, size: 18, font })
    y -= 30

    // Objectives
    if (Array.isArray(lesson.objectives) && lesson.objectives.length > 0) {
      page.drawText('Objectives:', { x: margin, y: y, size: 12, font })
      y -= 18
      for (const obj of lesson.objectives) {
        const lines = splitText(obj, 72)
        for (const line of lines) {
          page.drawText(`• ${line}`, { x: margin + 8, y, size: 10, font })
          y -= 14
        }
      }
      y -= 6
    }

    // Explanation overview
    if (lesson.explanation?.overview) {
      const lines = splitText(lesson.explanation.overview, 90)
      for (const line of lines) {
        if (y < 60) { y = newPage(doc, pageSize, font, margin) }
        page.drawText(line, { x: margin, y, size: 11, font })
        y -= 14
      }
      y -= 8
    }

    // Concepts
    if (Array.isArray(lesson.explanation?.concepts)) {
      for (const c of lesson.explanation.concepts) {
        if (!c) continue
        const title = c.title ? `${c.title}: ` : ''
        const text = (title + (c.explanation ?? '')).trim()
        const lines = splitText(text, 90)
        for (const line of lines) {
          if (y < 60) { y = newPage(doc, pageSize, font, margin) }
          page.drawText(line, { x: margin, y, size: 11, font })
          y -= 14
        }
        y -= 6
      }
    }
  }

  const uint8 = await doc.save()
  return Buffer.from(uint8)
}

function splitText(text: string, maxChars = 80) {
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

function newPage(doc: PDFDocument, pageSize: { width: number; height: number }, _font: any, margin: number) {
  doc.addPage([pageSize.width, pageSize.height])
  return pageSize.height - margin
}

/**
 * Build a compact progress-report PDF from structured report data.
 * Keeps the concrete PDF generation logic in one place for reuse by API routes/UI.
 */
export async function exportProgressReportToPDF(report: {
  studentName?: string
  date?: string
  narrative?: string
  sessionCount?: number
  readinessRows?: Array<{ subject: string; score: number }>
}): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([595, 842])
  const margin = 40
  // pdf-lib's PDFPage provides `getSize()` returning { width, height }
  let y = page.getSize().height - margin

  page.drawText('Progress Report', { x: margin, y, size: 18, font })
  y -= 28
  page.drawText(`Student: ${report.studentName ?? 'Student'}`, { x: margin, y, size: 12, font })
  y -= 18
  page.drawText(`Date: ${report.date ?? new Date().toLocaleDateString()}`, { x: margin, y, size: 12, font })
  y -= 22

  page.drawText("Teacher Vidya's insight:", { x: margin, y, size: 12, font })
  y -= 16
  const narrativeLines = splitText(report.narrative ?? '', 90)
  for (const line of narrativeLines) {
      if (y < margin + 40) {
      const np = doc.addPage([595, 842])
      y = np.getSize().height - margin
    }
    page.drawText(line, { x: margin, y, size: 11, font })
    y -= 14
  }
  y -= 8

  page.drawText('30-day summary:', { x: margin, y, size: 12, font })
  y -= 16
  page.drawText(`- Sessions in last 30 days: ${report.sessionCount ?? 0}`, { x: margin + 8, y, size: 11, font })
  y -= 14

  if (report.readinessRows && report.readinessRows.length > 0) {
    page.drawText('- Subject readiness:', { x: margin + 8, y, size: 11, font })
    y -= 14
    for (const r of report.readinessRows) {
      if (y < margin + 40) {
        const np = doc.addPage([595, 842])
        y = np.getSize().height - margin
      }
      page.drawText(`  • ${r.subject}: ${r.score}%`, { x: margin + 14, y, size: 10, font })
      y -= 12
    }
  }

  const uint8 = await doc.save()
  return Buffer.from(uint8)
}

export default exportCourseToPDF
