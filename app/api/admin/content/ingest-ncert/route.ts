/**
 * POST /api/admin/content/ingest-ncert
 *
 * Creates an IngestRunLog record immediately (admin can see it started),
 * then spawns the NCERT scraper using the local tsx binary so it works
 * even when npx/tsx is not in PATH on the VPS.
 *
 * Body: { subjectId, board, grade, language }
 * Auth: admin role required.
 * Returns: { ok: true, runId, message }
 */
import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
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

  const subject = await prisma.subjectDef.findUnique({
    where: { id: subjectId },
    select: { name: true, slug: true },
  })
  if (!subject) {
    return NextResponse.json({ error: 'subject_not_found' }, { status: 404 })
  }

  const subjectSlug = SUBJECT_SLUG_MAP[subject.name.toLowerCase()] ?? subject.slug.toLowerCase()
  const lang = (language ?? 'en').toLowerCase()

  // Create IngestRunLog immediately so admin can track progress
  const runLog = await prisma.ingestRunLog.create({
    data: {
      subjectId,
      fileSource: 'ncert-api-trigger',
      board: body.board ?? null,
      chunksCreated: 0,
      chunksUpdated: 0,
      embeddingsGenerated: 0,
      errors: 0,
      durationMs: 0,
    },
  })

  logger.info('[admin/content/ingest-ncert] spawning scraper', {
    event: 'ncert_ingest_started',
    context: { subjectId, grade, subjectSlug, lang, runId: runLog.id, adminId: session.user?.id },
  })

  // Use the local tsx binary so PATH is not required (fixes VPS silent failure)
  const tsxBin = path.join(process.cwd(), 'node_modules', '.bin', 'tsx')
  const args = [
    'scripts/scrape-ncert.ts',
    '--grade', String(grade),
    '--subject', subjectSlug,
    '--lang', lang,
    '--run-id', runLog.id,  // scraper updates this record instead of creating a new one
  ]

  const child = spawn(tsxBin, args, {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd(),
  })
  child.unref()

  return NextResponse.json({
    ok: true,
    runId: runLog.id,
    message: 'Ingestion started. Track progress in the ingest run log below.',
  })
}
