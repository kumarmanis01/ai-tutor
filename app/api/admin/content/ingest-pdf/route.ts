/**
 * POST /api/admin/content/ingest-pdf
 *
 * Accepts a PDF file upload (multipart/form-data) and ingests it as
 * CurriculumChunk rows, identical to what scrape-ncert does for NCERT PDFs.
 *
 * Use this for subjects where NCERT PDFs are not available online:
 *   - Sanskrit, French, Japanese, German, other language electives
 *   - ICSE syllabi (board is 'ICSE' -- no NCERT book URLs exist)
 *   - Any subject where the admin has a local copy of the textbook PDF
 *
 * Body: multipart/form-data
 *   file       -- PDF file (required)
 *   subjectId  -- SubjectDef.id (required)
 *   grade      -- numeric grade (required)
 *   language   -- 'en' | 'hi' (default 'en')
 *   board      -- board code e.g. 'CBSE' | 'ICSE' (default 'CBSE')
 *
 * Returns: { ok: true, runId, chunksCreated, chunksSkipped, embeddingsGenerated }
 */
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getEmbeddingsBatch } from '@/lib/ai/embeddings'
import { logger } from '@/lib/logger'

const CHUNK_WORDS = 375
const OVERLAP_WORDS = 37
const MIN_CHUNK_WORDS = 30
const MIN_PDF_CHARS = 200
const EMBED_BATCH_SIZE = 20
const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/^\s*\d+\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim()
}

function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const slice = words.slice(i, i + CHUNK_WORDS)
    if (slice.length >= MIN_CHUNK_WORDS) chunks.push(slice.join(' ').trim())
    i += CHUNK_WORDS - OVERLAP_WORDS
  }
  return chunks
}

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_form_data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const subjectId = formData.get('subjectId') as string | null
  const gradeRaw = formData.get('grade') as string | null
  const language = (formData.get('language') as string | null) ?? 'en'
  const board = ((formData.get('board') as string | null) ?? 'CBSE').toUpperCase()

  if (!file || !subjectId || !gradeRaw) {
    return NextResponse.json({ error: 'missing_fields', required: ['file', 'subjectId', 'grade'] }, { status: 400 })
  }

  const grade = parseInt(gradeRaw, 10)
  if (isNaN(grade) || grade < 1 || grade > 12) {
    return NextResponse.json({ error: 'invalid_grade' }, { status: 400 })
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'file_too_large', maxMB: 50 }, { status: 413 })
  }

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'file_must_be_pdf' }, { status: 400 })
  }

  const subject = await prisma.subjectDef.findUnique({
    where: { id: subjectId },
    select: { name: true, slug: true },
  })
  if (!subject) {
    return NextResponse.json({ error: 'subject_not_found' }, { status: 404 })
  }

  const runLog = await prisma.ingestRunLog.create({
    data: {
      subjectId,
      fileSource: 'pdf-upload',
      board,
      chunksCreated: 0,
      chunksUpdated: 0,
      embeddingsGenerated: 0,
      errors: 0,
      durationMs: 0,
    },
  })

  const startedAt = Date.now()

  logger.info('[admin/content/ingest-pdf] starting', {
    event: 'pdf_ingest_started',
    context: { subjectId, grade, board, language, runId: runLog.id, adminId: session.user?.id, fileName: file.name },
  })

  let pdfText: string
  try {
    const buf = Buffer.from(await file.arrayBuffer())

    // Dynamic import avoids top-level module load cost for non-PDF requests
    const pdfModule = await import('pdf-parse') as any
    const pdfParse: (buf: Buffer) => Promise<{ text: string }> = pdfModule.default ?? pdfModule
    const data = await pdfParse(buf)
    pdfText = data.text ?? ''
  } catch (err) {
    logger.error('[admin/content/ingest-pdf] pdf extraction failed', {
      event: 'pdf_ingest_extract_error',
      context: { runId: runLog.id, error: String(err) },
    })
    await prisma.ingestRunLog.update({
      where: { id: runLog.id },
      data: { errors: 1, durationMs: Date.now() - startedAt },
    })
    return NextResponse.json({ error: 'pdf_extraction_failed', detail: String(err) }, { status: 422 })
  }

  const cleaned = cleanText(pdfText)
  if (cleaned.length < MIN_PDF_CHARS) {
    await prisma.ingestRunLog.update({
      where: { id: runLog.id },
      data: { errors: 1, durationMs: Date.now() - startedAt },
    })
    return NextResponse.json({ error: 'pdf_too_sparse', detail: 'PDF appears to be image-based (no extractable text).' }, { status: 422 })
  }

  const rawChunks = chunkText(cleaned)
  const subjectSlug = subject.slug.toLowerCase()

  let chunksCreated = 0
  let chunksSkipped = 0
  const toEmbed: { id: string; content: string }[] = []

  for (const content of rawChunks) {
    const contentHash = sha256(content)
    const existing = await prisma.$queryRaw<{ id: string; has_embedding: boolean }[]>`
      SELECT id, (embedding IS NOT NULL) AS has_embedding
      FROM "CurriculumChunk"
      WHERE "contentHash" = ${contentHash}
      LIMIT 1
    `
    if (existing.length > 0) {
      if (!existing[0].has_embedding) toEmbed.push({ id: existing[0].id, content })
      chunksSkipped++
    } else {
      const row = await prisma.curriculumChunk.create({
        data: {
          content,
          contentHash,
          board,
          subject: subjectSlug,
          grade: String(grade),
          conceptIds: [],
        },
        select: { id: true },
      })
      toEmbed.push({ id: row.id, content })
      chunksCreated++
    }
  }

  let embeddingsGenerated = 0
  let embedErrors = 0

  for (let i = 0; i < toEmbed.length; i += EMBED_BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + EMBED_BATCH_SIZE)
    try {
      const embeddings = await getEmbeddingsBatch(batch.map((c) => c.content), EMBED_BATCH_SIZE)
      for (let j = 0; j < batch.length; j++) {
        const embedding = embeddings[j]
        if (!embedding) { embedErrors++; continue }
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE "CurriculumChunk" SET embedding = $1::vector, "updatedAt" = NOW() WHERE id = $2`,
            `[${embedding.join(',')}]`,
            batch[j].id,
          )
          embeddingsGenerated++
        } catch (dbErr) {
          logger.error('[admin/content/ingest-pdf] embedding write failed', {
            event: 'pdf_ingest_embed_db_error',
            context: { runId: runLog.id, chunkId: batch[j].id, error: String(dbErr) },
          })
          embedErrors++
        }
      }
    } catch (apiErr) {
      logger.error('[admin/content/ingest-pdf] embedding API failed', {
        event: 'pdf_ingest_embed_api_error',
        context: { runId: runLog.id, batchStart: i, error: String(apiErr) },
      })
      embedErrors += batch.length
    }
  }

  const durationMs = Date.now() - startedAt
  await prisma.ingestRunLog.update({
    where: { id: runLog.id },
    data: { chunksCreated, chunksUpdated: chunksSkipped, embeddingsGenerated, errors: embedErrors, durationMs },
  })

  logger.info('[admin/content/ingest-pdf] completed', {
    event: 'pdf_ingest_completed',
    context: { runId: runLog.id, chunksCreated, chunksSkipped, embeddingsGenerated, embedErrors, durationMs },
  })

  return NextResponse.json({ ok: true, runId: runLog.id, chunksCreated, chunksSkipped, embeddingsGenerated, embedErrors })
}
