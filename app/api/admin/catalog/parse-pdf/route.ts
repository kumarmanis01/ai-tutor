import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { logger } from '@/lib/logger'

const CHUNK_WORDS = 400
const OVERLAP_WORDS = 50

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const slice = words.slice(i, i + CHUNK_WORDS)
    if (slice.length > 10) chunks.push(slice.join(' '))
    i += CHUNK_WORDS - OVERLAP_WORDS
  }
  return chunks
}

export async function POST(req: NextRequest) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'invalid_form' }, { status: 400 })

  const file = form.get('pdf')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'no_pdf' }, { status: 400 })

  const board = String(form.get('board') ?? 'CBSE')
  const subjectId = form.get('subjectId') ? String(form.get('subjectId')) : null
  const grade = form.get('grade') ? String(form.get('grade')) : null
  const fileSource = file instanceof File ? file.name : 'upload.pdf'

  const startMs = Date.now()
  let chunksCreated = 0
  let chunksSkipped = 0
  let embeddingsPending = 0
  let errors = 0

  try {
    const buf = Buffer.from(await file.arrayBuffer())

    let text = ''
    try {
      const pdfParse = (await import('pdf-parse')).default as (buf: Buffer) => Promise<{ text: string }>
      const data = await pdfParse(buf)
      text = String(data.text ?? '')
    } catch (e) {
      logger.warn('pdf-parse not available or failed; falling back to naive text extraction')
      logger.error('pdf-parse error:', e as Error)
      text = buf.toString('latin1')
    }

    const textChunks = chunkText(text)
    if (textChunks.length === 0) {
      return NextResponse.json({ error: 'no_text_extracted' }, { status: 422 })
    }

    for (const chunkText of textChunks) {
      const hash = sha256(chunkText)
      try {
        // Check if chunk with same hash already exists
        const existing = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM "CurriculumChunk" WHERE "contentHash" = ${hash} LIMIT 1
        `
        if (existing.length > 0) {
          chunksSkipped++
          continue
        }

        await prisma.curriculumChunk.create({
          data: {
            content: chunkText,
            contentHash: hash,
            board,
            subject: subjectId ?? undefined,
            grade: grade ?? undefined,
            version: 1,
          },
        })
        chunksCreated++
        embeddingsPending++
      } catch (err) {
        logger.error('[parse-pdf] chunk upsert error:', err as Error)
        errors++
      }
    }

    // Signal pending embeddings via Redis key (best-effort)
    if (subjectId && embeddingsPending > 0) {
      try {
        const { redis } = await import('@/lib/redis/client')
        await redis.set(`ingest:pending:${subjectId}`, embeddingsPending, { ex: 86400 })
      } catch {
        // Non-fatal — embedding pipeline will scan DB directly
      }
    }

    // Write IngestRunLog
    try {
      await prisma.ingestRunLog.create({
        data: {
          fileSource,
          board,
          subjectId,
          chunksCreated,
          chunksUpdated: 0,
          embeddingsGenerated: 0,
          errors,
          durationMs: Date.now() - startMs,
        },
      })
    } catch (err) {
      logger.warn('[parse-pdf] Could not write IngestRunLog:', err as Error)
    }

    return NextResponse.json({ ok: true, chunksCreated, chunksSkipped, embeddingsPending })
  } catch (e) {
    return NextResponse.json(
      { error: 'parse_failed', message: String((e as Error)?.message ?? e) },
      { status: 500 },
    )
  }
}
