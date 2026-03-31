/**
 * scripts/scrape-ncert.ts
 *
 * Downloads NCERT chapter PDFs from ncert.nic.in using the 2024-25 book map
 * (no HEAD probing -- chapter counts are known), extracts text via
 * pdf-parse, chunks at ~500 tokens with 50-token overlap, deduplicates via
 * SHA-256, embeds via text-embedding-3-small in batches of 20, and upserts
 * CurriculumChunk rows. Writes one IngestRunLog entry per grade run.
 *
 * Covers CBSE grades 1-12.  Uses native fetch (Node 18+) -- no extra deps.
 *
 * Usage:
 *   npx tsx scripts/scrape-ncert.ts --grade 10 --subject mathematics --lang en
 *   npx tsx scripts/scrape-ncert.ts --subject mathematics --all-grades --lang en
 *   npx tsx scripts/scrape-ncert.ts --grade 10 --subject mathematics --dry-run
 *   npx tsx scripts/scrape-ncert.ts --grade 10 --subject mathematics --url <pdf-url>
 *
 * Env required: DATABASE_URL, OPENAI_API_KEY
 */

import { createHash } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { getEmbeddingsBatch } from '../lib/ai/embeddings'

// ── Constants ─────────────────────────────────────────────────────────────────

/** 375 words ≈ 500 tokens at ~1.33 tokens/word for English text. */
const CHUNK_WORDS = 375
/** 37 words ≈ 50-token overlap between consecutive chunks. */
const OVERLAP_WORDS = 37
/** Drop chunks shorter than this -- catches headers, footers, page numbers. */
const MIN_CHUNK_WORDS = 30
/** Scanned/image PDFs produce almost no text -- skip them. */
const MIN_PDF_CHARS = 200
/** OpenAI embedding batch size. */
const BATCH_SIZE = 20
/** Be polite to NCERT's server. */
const REQUEST_DELAY_MS = 1000
/** Probe up to this many chapters per book (used only for --url override path). */
const MAX_CHAPTERS = 16

const BASE_URL = 'https://ncert.nic.in/textbook/pdf'

// ── NCERT_BOOK_MAP ────────────────────────────────────────────────────────────

interface BookInfo {
  /** Base code for building chapter PDF URLs. */
  code: string
  /** Exact chapter count for this book (2024-25 edition). */
  chapters: number
}

/**
 * Maps subject → grade → NCERT chapter PDF info (2024-25 edition).
 * Chapter URL pattern: {BASE_URL}/{code}{chapter:02d}.pdf
 * Example: grade 10 maths ch 3 → https://ncert.nic.in/textbook/pdf/jemh103.pdf
 * Example: grade 6 science ch 1 → https://ncert.nic.in/textbook/pdf/fecu101.pdf
 *
 * Grade 6 Science is now "Curiosity" (fecu1) -- updated 2024.
 * Grade 6 Maths is now "Ganita Prakash" (fmth6) -- updated 2024.
 * Grades 1-5 and standalone Physics/Chemistry/Biology are out of MVP scope.
 */
const NCERT_BOOK_MAP: Record<string, Record<number, BookInfo>> = {
  science: {
    6:  { code: 'fecu1',  chapters: 12 }, // Curiosity 2024
    7:  { code: 'gesc1',  chapters: 18 },
    8:  { code: 'hesc1',  chapters: 18 },
    9:  { code: 'iesc1',  chapters: 15 },
    10: { code: 'jesc1',  chapters: 16 },
  },
  mathematics: {
    6:  { code: 'fmth6',  chapters: 10 }, // Ganita Prakash 2024
    7:  { code: 'gmt1',   chapters: 15 },
    8:  { code: 'hmth1',  chapters: 16 },
    9:  { code: 'iemh1',  chapters: 15 },
    10: { code: 'jemh1',  chapters: 15 },
    11: { code: 'kemh1',  chapters: 16 },
    12: { code: 'lemh1',  chapters: 13 },
  },
  'social-science': {
    6:  { code: 'fess1',  chapters: 9  }, // Exploring Society 2024
    7:  { code: 'gess1',  chapters: 10 },
    8:  { code: 'hess1',  chapters: 10 },
    9:  { code: 'jess1',  chapters: 8  },
    10: { code: 'jess2',  chapters: 8  },
  },
  english: {
    6:  { code: 'fehl1',  chapters: 10 }, // Poorvi 2024
    7:  { code: 'gehl1',  chapters: 10 },
    8:  { code: 'hehl1',  chapters: 10 },
    9:  { code: 'ieel1',  chapters: 11 },
    10: { code: 'jeel1',  chapters: 11 },
  },
  hindi: {
    6:  { code: 'fhhl1',  chapters: 17 }, // Vasant
    7:  { code: 'ghhl1',  chapters: 20 },
    8:  { code: 'hhhl1',  chapters: 18 },
    9:  { code: 'ihhl1',  chapters: 19 },
    10: { code: 'jhhl1',  chapters: 17 },
  },
}

const SUBJECT_ALIASES: Record<string, string> = {
  mathematics:      'mathematics', math: 'mathematics', maths: 'mathematics',
  science:          'science',
  'social-science': 'social-science', sst: 'social-science', social: 'social-science',
  english:          'english',
  hindi:            'hindi',
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms))

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

// ── CLI args ──────────────────────────────────────────────────────────────────

interface Args {
  grade: number | null  // null when --all-grades is set
  allGrades: boolean
  subject: string
  board: string
  lang: string
  urlOverride: string | null
  dryRun: boolean
  runId: string | null  // IngestRunLog ID created by the API -- update it instead of creating new
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  function flag(name: string): string | null {
    const i = argv.indexOf(`--${name}`)
    return i !== -1 ? (argv[i + 1] ?? null) : null
  }

  const allGrades = argv.includes('--all-grades')
  let grade: number | null = null
  if (!allGrades) {
    const gradeRaw = flag('grade')
    if (!gradeRaw) {
      console.error('[scrape-ncert] --grade is required (or use --all-grades)')
      process.exit(1)
    }
    grade = parseInt(gradeRaw, 10)
    if (isNaN(grade) || grade < 1 || grade > 12) {
      console.error(`[scrape-ncert] --grade must be 1-12, got "${gradeRaw}"`); process.exit(1)
    }
  }

  const subjectRaw = flag('subject')
  if (!subjectRaw) { console.error('[scrape-ncert] --subject is required'); process.exit(1) }
  const subject = SUBJECT_ALIASES[subjectRaw.toLowerCase().trim()]
  if (!subject) {
    console.error(
      `[scrape-ncert] Unknown subject "${subjectRaw}". Known: ${Object.keys(SUBJECT_ALIASES).join(', ')}`,
    )
    process.exit(1)
  }

  const urlOverride = flag('url')
  if (urlOverride && allGrades) {
    console.error('[scrape-ncert] --url and --all-grades cannot be used together')
    process.exit(1)
  }

  return {
    grade,
    allGrades,
    subject,
    board: (flag('board') ?? 'cbse').toUpperCase(),
    lang:  (flag('lang')  ?? 'en').toLowerCase(),
    urlOverride,
    dryRun: argv.includes('--dry-run'),
    runId: flag('run-id'),
  }
}

/** Return all grades that have a NCERT_BOOK_MAP entry for the given subject. */
function availableGrades(subject: string): number[] {
  return Object.keys(NCERT_BOOK_MAP[subject] ?? {})
    .map(Number)
    .sort((a, b) => a - b)
}

// ── URL helpers ───────────────────────────────────────────────────────────────

function buildChapterUrl(code: string, chapter: number): string {
  return `${BASE_URL}/${code}${String(chapter).padStart(2, '0')}.pdf`
}

// ── Step 1: Chapter URL generation ───────────────────────────────────────────

interface ChapterRef { chapter: number; url: string }

/**
 * For a URL override (--url flag): treat it as a single chapter 1 PDF.
 * Otherwise: generate all chapter URLs directly from NCERT_BOOK_MAP chapter
 * count -- no HEAD probing needed since counts are verified per 2024-25 edition.
 * Falls back to HEAD probing (up to MAX_CHAPTERS) only for unknown books.
 */
async function discoverChapterUrls(
  code: string,
  grade: number,
  urlOverride: string | null,
  knownChapters: number | null,
): Promise<ChapterRef[]> {
  if (urlOverride) {
    console.log(`[scrape-ncert] Using --url override: ${urlOverride}`)
    return [{ chapter: 1, url: urlOverride }]
  }

  if (knownChapters !== null) {
    // Chapter count is known from NCERT_BOOK_MAP -- generate URLs directly
    console.log(
      `[scrape-ncert] grade ${grade}: generating ${knownChapters} chapter URL(s) from map ...`,
    )
    const refs: ChapterRef[] = []
    for (let ch = 1; ch <= knownChapters; ch++) {
      const url = buildChapterUrl(code, ch)
      refs.push({ chapter: ch, url })
      console.log(`  Chapter ${ch.toString().padStart(2, '0')}: ${url}`)
    }
    return refs
  }

  // Fallback: HEAD probe up to MAX_CHAPTERS for books not in NCERT_BOOK_MAP
  const found: ChapterRef[] = []
  console.log(
    `[scrape-ncert] Probing grade ${grade} chapters 01-${MAX_CHAPTERS.toString().padStart(2, '0')} (HEAD) ...`,
  )
  for (let ch = 1; ch <= MAX_CHAPTERS; ch++) {
    const url = buildChapterUrl(code, ch)
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NCERT-scraper/1.0; educational-use)' },
      })
      if (res.ok) {
        found.push({ chapter: ch, url })
        console.log(`  ✓ Chapter ${ch.toString().padStart(2, '0')}: ${url}`)
      }
    } catch {
      // Network error / timeout -- chapter does not exist at this URL
    }
    if (ch < MAX_CHAPTERS) await sleep(REQUEST_DELAY_MS)
  }
  return found
}

// ── Step 2: Download PDF into memory ─────────────────────────────────────────

async function downloadPdf(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NCERT-scraper/1.0; educational-use)' },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
  // Buffer is used here and immediately passed to pdf-parse -- never written to disk
}

// ── Step 2 cont.: Extract text, validate, clean ───────────────────────────────

async function extractText(buf: Buffer, chapterNum: number): Promise<string | null> {
  // Dynamic import so --dry-run and module loading never require pdf-parse
  // (pdf-parse depends on pdfjs-dist which may not be available in all envs)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pdfParse: (buf: Buffer) => Promise<{ text: string }>
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('pdf-parse') as any
    pdfParse = mod.default ?? mod
  } catch {
    console.warn(`  Chapter ${chapterNum}: pdf-parse not available -- skipping`)
    return null
  }

  let rawText: string
  try {
    const data = await pdfParse(buf)
    rawText = data.text
  } catch {
    console.warn(`  Chapter ${chapterNum}: pdf-parse failed -- skipping`)
    return null
  }

  const text = cleanText(rawText)
  console.log(`  Chapter ${chapterNum}: extracted ${text.length} chars`)

  if (text.length < MIN_PDF_CHARS) {
    console.log(
      `  Chapter ${chapterNum}: skipping -- likely scanned image PDF (< ${MIN_PDF_CHARS} chars)`,
    )
    return null
  }
  return text
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    // Strip lines that are purely numeric (page numbers)
    .replace(/^\s*\d+\s*$/gm, '')
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, '\n\n')
    // Normalise horizontal whitespace
    .replace(/[^\S\n]+/g, ' ')
    .trim()
}

// ── Step 3: Chunk ─────────────────────────────────────────────────────────────

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

// ── Steps 4+6: Upsert CurriculumChunk (idempotent) ───────────────────────────

interface ChunkRecord {
  content: string
  contentHash: string
  board: string
  subject: string
  grade: string
  /** Tags stored in conceptIds: chapter:N, chunkIndex:I, source:ncert, lang:X */
  conceptIds: string[]
}

interface EmbedItem { id: string; content: string }

async function upsertChunks(
  prisma: PrismaClient,
  records: ChunkRecord[],
): Promise<{ toEmbed: EmbedItem[]; created: number; skipped: number }> {
  let created = 0
  let skipped = 0
  const toEmbed: EmbedItem[] = []

  for (const rec of records) {
    // Step 4: idempotency -- check by contentHash.
    // embedding is Unsupported("vector(1536)") → must use raw SQL to inspect it.
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT id, (embedding IS NOT NULL) AS has_embedding
       FROM "CurriculumChunk"
       WHERE "contentHash" = $1
       LIMIT 1`,
      rec.contentHash,
    )) as { id: string; has_embedding: boolean }[]

    if (rows.length > 0) {
      // Already exists -- queue for re-embedding only if embedding is missing
      if (!rows[0].has_embedding) toEmbed.push({ id: rows[0].id, content: rec.content })
      skipped++
    } else {
      // Step 6: persist new chunk
      const row = await prisma.curriculumChunk.create({
        data: {
          content:     rec.content,
          contentHash: rec.contentHash,
          board:       rec.board,
          subject:     rec.subject,
          grade:       rec.grade,
          conceptIds:  rec.conceptIds,
        },
        select: { id: true },
      })
      toEmbed.push({ id: row.id, content: rec.content })
      created++
    }
  }

  return { toEmbed, created, skipped }
}

// ── Step 5: Embed in batches of 20 ───────────────────────────────────────────

interface EmbedStats {
  embedded: number
  errors: number
  errorDetails: { id: string; error: string }[]
}

async function embedChunks(prisma: PrismaClient, toEmbed: EmbedItem[]): Promise<EmbedStats> {
  let embedded = 0
  let errors = 0
  const errorDetails: { id: string; error: string }[] = []

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE)
    const embeddings = await getEmbeddingsBatch(batch.map((c) => c.content), BATCH_SIZE)

    for (let j = 0; j < batch.length; j++) {
      const embedding = embeddings[j]
      if (!embedding) {
        // On failure: log and continue -- don't abort whole run
        console.error(`[scrape-ncert] ✗ Embedding failed for chunk ${batch[j].id}`)
        errors++
        errorDetails.push({ id: batch[j].id, error: 'embedding_api_null' })
        continue
      }
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "CurriculumChunk" SET embedding = $1::vector, "updatedAt" = NOW() WHERE id = $2`,
          `[${embedding.join(',')}]`,
          batch[j].id,
        )
        embedded++
      } catch (err) {
        console.error(`[scrape-ncert] ✗ DB error writing embedding for chunk ${batch[j].id}:`, err)
        errors++
        errorDetails.push({ id: batch[j].id, error: String(err) })
      }
    }
    console.log(`[scrape-ncert] Embedded ${Math.min(i + BATCH_SIZE, toEmbed.length)}/${toEmbed.length}`)
  }

  return { embedded, errors, errorDetails }
}

// ── SubjectDef lookup (for IngestRunLog.subjectId) ────────────────────────────

async function resolveSubjectId(
  prisma: PrismaClient,
  subject: string,
  grade: number,
): Promise<string | null> {
  try {
    const row = await prisma.subjectDef.findFirst({
      where: { code: subject, classLevel: { level: grade } },
      select: { id: true },
    })
    return row?.id ?? null
  } catch {
    return null
  }
}

// ── Step 7: IngestRunLog ──────────────────────────────────────────────────────

async function writeRunLog(
  prisma: PrismaClient,
  opts: {
    fileSource: string
    board: string
    subjectId: string | null
    chunksCreated: number
    chunksUpdated: number
    embeddingsGenerated: number
    errors: number
    startMs: number
    errorDetails?: unknown
    runId?: string | null  // if set, UPDATE this record; otherwise CREATE a new one
  },
): Promise<void> {
  const data = {
    fileSource:          opts.fileSource,
    board:               opts.board,
    subjectId:           opts.subjectId ?? undefined,
    chunksCreated:       opts.chunksCreated,
    chunksUpdated:       opts.chunksUpdated,
    embeddingsGenerated: opts.embeddingsGenerated,
    errors:              opts.errors,
    durationMs:          Date.now() - opts.startMs,
    errorDetails:        opts.errorDetails ? (opts.errorDetails as object) : undefined,
  }
  try {
    if (opts.runId) {
      // Update the record pre-created by the API so admin sees live results on the same row
      await prisma.ingestRunLog.update({ where: { id: opts.runId }, data })
      console.log('[scrape-ncert] IngestRunLog updated.')
    } else {
      await prisma.ingestRunLog.create({ data })
      console.log('[scrape-ncert] IngestRunLog written.')
    }
  } catch (err) {
    console.warn('[scrape-ncert] Could not write IngestRunLog:', err)
  }
}

// ── Per-grade pipeline ────────────────────────────────────────────────────────

async function runForGrade(
  prisma: PrismaClient,
  args: Args,
  grade: number,
): Promise<{ errors: number }> {
  const startMs = Date.now()
  console.log(
    `\n[scrape-ncert] ── grade=${grade} subject=${args.subject} board=${args.board} lang=${args.lang} ──`,
  )

  // Resolve book info (may be null for grades/subjects without a mapping)
  const bookInfo = NCERT_BOOK_MAP[args.subject]?.[grade] ?? null
  if (!bookInfo && !args.urlOverride) {
    console.warn(
      `[scrape-ncert] No book info for grade ${grade} ${args.subject} in NCERT_BOOK_MAP -- skipping.`,
    )
    return { errors: 0 }
  }
  const code = bookInfo?.code ?? ''
  const knownChapters = bookInfo?.chapters ?? null

  // ── Step 1: Chapter URL generation ───────────────────────────────────────
  const chapters = await discoverChapterUrls(code, grade, args.urlOverride, knownChapters)
  if (chapters.length === 0) {
    console.warn(
      `[scrape-ncert] No chapters found for grade ${grade} ${args.subject}. ` +
      `Book code "${code}" may be stale -- use --url <pdf-url> to test a direct link, ` +
      `or update NCERT_BOOK_MAP with the correct 2024-25 code.`,
    )
    return { errors: 0 }
  }
  console.log(`[scrape-ncert] ${chapters.length} chapter(s) found for grade ${grade}.`)

  // Dry run: chapter URLs are now printed above -- stop here
  if (args.dryRun) {
    console.log(`[scrape-ncert] Dry run complete for grade ${grade}.`)
    return { errors: 0 }
  }

  // ── Steps 2-6: Download → parse → chunk → deduplicate → embed ─────────────
  const subjectId = await resolveSubjectId(prisma, args.subject, grade)
  const allRecords: ChunkRecord[] = []

  for (let idx = 0; idx < chapters.length; idx++) {
    const { chapter, url } = chapters[idx]
    console.log(`[scrape-ncert] Downloading chapter ${chapter} ...`)

    let buf: Buffer
    try {
      buf = await downloadPdf(url)
    } catch (err) {
      console.error(`[scrape-ncert] ✗ Download failed for chapter ${chapter}:`, err)
      continue
    }

    // Extract text; buf is discarded after this call -- never written to disk
    const text = await extractText(buf, chapter)
    if (!text) continue  // scanned PDF or parse failure

    const rawChunks = chunkText(text)
    console.log(`  Chapter ${chapter}: ${rawChunks.length} chunks`)

    for (let i = 0; i < rawChunks.length; i++) {
      // Step 3 tag: encode chapter + chunkIndex in conceptIds (schema has no metadata field)
      allRecords.push({
        content:     rawChunks[i],
        contentHash: sha256(rawChunks[i]),
        board:       args.board,
        subject:     args.subject,
        grade:       String(grade),
        conceptIds:  [
          `chapter:${chapter}`,
          `chunkIndex:${i}`,
          `source:ncert`,
          `lang:${args.lang}`,
        ],
      })
    }

    // 1 s delay between chapter downloads -- don't hammer NCERT
    if (idx < chapters.length - 1) await sleep(REQUEST_DELAY_MS)
  }

  if (allRecords.length === 0) {
    console.log(`[scrape-ncert] No usable chunks extracted for grade ${grade}.`)
    return { errors: 0 }
  }
  console.log(`[scrape-ncert] Total chunks this grade: ${allRecords.length}`)

  // ── Steps 4+5: Upsert + embed ─────────────────────────────────────────────
  const { toEmbed, created, skipped } = await upsertChunks(prisma, allRecords)
  console.log(`[scrape-ncert] Chunks: ${created} created, ${skipped} skipped (hash match)`)

  let embeds: EmbedStats = { embedded: 0, errors: 0, errorDetails: [] }
  if (toEmbed.length > 0) {
    console.log(`[scrape-ncert] Embedding ${toEmbed.length} chunk(s) ...`)
    embeds = await embedChunks(prisma, toEmbed)
    console.log(`[scrape-ncert] Embedded: ${embeds.embedded}, Errors: ${embeds.errors}`)
  } else {
    console.log('[scrape-ncert] All chunks already embedded -- nothing to do.')
  }

  // ── Step 7: IngestRunLog ──────────────────────────────────────────────────
  await writeRunLog(prisma, {
    fileSource:          `ncert-scraper:grade${grade}:${args.subject}`,
    board:               args.board,
    subjectId,
    chunksCreated:       created,
    chunksUpdated:       0,
    embeddingsGenerated: embeds.embedded,
    errors:              embeds.errors,
    startMs,
    errorDetails:        embeds.errorDetails.length > 0 ? embeds.errorDetails : undefined,
    runId:               args.runId,
  })

  // ── Step 8: Output summary ────────────────────────────────────────────────
  const durationSec = ((Date.now() - startMs) / 1000).toFixed(1)
  console.log(
    `[scrape-ncert] ✓ grade ${grade} done in ${durationSec}s -- ` +
    `${allRecords.length} chunks, ${embeds.embedded} embedded, ${embeds.errors} errors.`,
  )

  return { errors: embeds.errors }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs()

  if (args.dryRun) {
    console.log('[scrape-ncert] DRY RUN -- probing chapter URLs only. No downloads, no DB writes.')
  }

  const grades: number[] = args.allGrades
    ? availableGrades(args.subject)
    : [args.grade as number]

  if (grades.length === 0) {
    console.error(
      `[scrape-ncert] No grades in BOOK_MAP for subject="${args.subject}". ` +
      `Use --url <pdf-url> to ingest a specific PDF directly.`,
    )
    process.exit(1)
  }

  if (args.allGrades) {
    console.log(
      `[scrape-ncert] --all-grades: grades ${grades.join(', ')} for ${args.subject}`,
    )
  }

  const prisma = new PrismaClient()
  let totalErrors = 0

  try {
    for (const grade of grades) {
      const { errors } = await runForGrade(prisma, args, grade)
      totalErrors += errors
    }
  } finally {
    await prisma.$disconnect()
  }

  if (grades.length > 1) {
    console.log(
      `\n[scrape-ncert] ✓ All ${grades.length} grades complete. Total errors: ${totalErrors}`,
    )
  }

  if (totalErrors > 0) process.exit(1)
}

main().catch((err) => {
  console.error('[scrape-ncert] Fatal:', err?.message ?? err)
  process.exit(1)
})
