/**
 * POST /api/admin/content/ingest-ncert
 *
 * Spawns the NCERT scraper script in the background on the VPS.
 * Returns immediately — admin refreshes the page after a few minutes.
 *
 * Body: { subjectId, board, grade, language }
 * Auth: admin role required.
 * Spawns: npx tsx scripts/scrape-ncert.ts --grade N --subject X --lang Y
 * Non-blocking: returns { ok: true, message: "Ingestion started — check IngestRunLog" }
 */
import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

// Map canonical subject name to the slug expected by scrape-ncert.ts
const SUBJECT_SLUG_MAP: Record<string, string> = {
  mathematics: 'mathematics',
  math: 'mathematics',
  science: 'science',
  physics: 'physics',
  chemistry: 'chemistry',
  biology: 'biology',
}

export async function POST(req: Request) {
  // session check → role check → business logic (CLAUDE.md rule 8)
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  let body: { subjectId?: string; board?: string; grade?: number; language?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { subjectId, grade, language } = body
  if (!subjectId || grade == null) {
    return NextResponse.json({ error: 'missing_fields', required: ['subjectId', 'grade'] }, { status: 400 })
  }

  // Resolve subject name from SubjectDef
  const subject = await prisma.subjectDef.findUnique({
    where: { id: subjectId },
    select: { name: true, slug: true },
  })
  if (!subject) {
    return NextResponse.json({ error: 'subject_not_found' }, { status: 404 })
  }

  const subjectSlug = SUBJECT_SLUG_MAP[subject.name.toLowerCase()] ?? subject.slug.toLowerCase()
  const lang = (language ?? 'en').toLowerCase()

  // Spawn scraper in background — non-blocking
  const args = [
    'tsx',
    'scripts/scrape-ncert.ts',
    '--grade',
    String(grade),
    '--subject',
    subjectSlug,
    '--lang',
    lang,
  ]

  logger.info('[admin/content/ingest-ncert] spawning scraper', {
    event: 'ncert_ingest_started',
    context: { subjectId, grade, subjectSlug, lang, adminId: session.user?.id },
  })

  const child = spawn('npx', args, {
    detached: true,
    stdio: 'ignore',
    // Run from project root so relative paths resolve correctly
    cwd: process.cwd(),
  })
  child.unref() // Allow Node to exit without waiting for this child

  // Write AuditLog for traceability
  try {
    await prisma.auditLog.create({
      data: {
        adminId: session.user?.id ?? null,
        targetEntity: 'IngestRunLog',
        targetId: subjectId,
        action: 'CONTENT_APPROVE',
        newValue: { subjectId, grade, subjectSlug, lang, script: 'scripts/scrape-ncert.ts' },
      },
    })
  } catch (auditErr) {
    logger.warn('[admin/content/ingest-ncert] failed to write AuditLog', {
      event: 'audit_log_failed',
      context: { error: String(auditErr) },
    })
  }

  return NextResponse.json({
    ok: true,
    message: 'Ingestion started — check IngestRunLog in a few minutes for results.',
  })
}
