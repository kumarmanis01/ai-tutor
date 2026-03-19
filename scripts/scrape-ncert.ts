/**
 * scripts/scrape-ncert.ts
 *
 * Downloads NCERT textbook ZIP from ncert.nic.in, parses all PDFs inside,
 * chunks text at ~500 tokens / 50-token overlap, upserts CurriculumChunk rows
 * with SHA-256 idempotency, embeds via text-embedding-3-small, and writes an
 * IngestRunLog entry with final stats.
 *
 * Usage:
 *   npx tsx scripts/scrape-ncert.ts --grade 10 --subject mathematics --board cbse --lang en
 *   npx tsx scripts/scrape-ncert.ts --grade 10 --subject science    --board cbse --lang en
 *
 * Optional:
 *   --url <override>   Skip the built-in URL table and fetch from this URL directly.
 *   --dry-run          Parse + chunk but skip DB writes and embeddings.
 *
 * Env required:
 *   DATABASE_URL, OPENAI_API_KEY
 */

import { createHash } from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execSync } from 'child_process'
// pdf-parse has no @types package — same pattern as other untyped deps in this repo
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import pdfParse from 'pdf-parse'
import { PrismaClient } from '@prisma/client'
import { getEmbeddingsBatch } from '../lib/ai/embeddings'

// ── Constants ─────────────────────────────────────────────────────────────────

const BATCH_SIZE = 20
/**
 * 375 words ≈ 500 tokens (at ~1.33 tokens/word for English text).
 * 37 words ≈ 50-token overlap.
 */
const CHUNK_WORDS = 375
const OVERLAP_WORDS = 37
/** Drop chunks shorter than this — avoids headers, footers, page numbers. */
const MIN_CHUNK_WORDS = 30

const BASE_URL = 'https://ncert.nic.in/textbook/pdf'

/**
 * NCERT URL code table: `${grade}-${normalised_subject}-${lang}` → filename stem.
 * Filename stem + '.zip' is the full download path under BASE_URL.
 *
 * Pattern: {gradeCode}{mediumCode}{subjectCode}1dd
 *   gradeCode : f=6, g=7, h=8, i=9, j=10, k=11, l=12
 *   mediumCode: e=English, h=Hindi
 *   1dd        = all chapters combined
 *
 * Two URLs verified by the spec author:
 *   jemh1dd → Grade 10 English Mathematics   ✓
 *   jesc1dd → Grade 10 English Science        ✓
 */
const URL_TABLE: Record<string, string> = {
  '6-mathematics-en':  'femh1dd',
  '6-science-en':      'fesc1dd',
  '7-mathematics-en':  'gemh1dd',
  '7-science-en':      'gesc1dd',
  '8-mathematics-en':  'hemh1dd',
  '8-science-en':      'hesc1dd',
  '9-mathematics-en':  'iemh1dd',
  '9-science-en':      'iesc1dd',
  '10-mathematics-en': 'jemh1dd',
  '10-science-en':     'jesc1dd',
  '11-mathematics-en': 'kemh1dd',
  '11-physics-en':     'keph1dd',
  '11-chemistry-en':   'kech1dd',
  '11-biology-en':     'kebo1dd',
  '12-mathematics-en': 'lemh1dd',
  '12-physics-en':     'leph1dd',
  '12-chemistry-en':   'lech1dd',
  '12-biology-en':     'lebo1dd',
}

/** Map user-supplied subject strings to canonical keys used in URL_TABLE. */
const SUBJECT_ALIASES: Record<string, string> = {
  mathematics: 'mathematics', math: 'mathematics', maths: 'mathematics',
  science: 'science',
  physics: 'physics',
  chemistry: 'chemistry',
  biology: 'biology',
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
      console.error(`[scrape-ncert] --grade must be 1–12, got "${gradeRaw}"`); process.exit(1)
    }
  }

  const subjectRaw = flag('subject')
  if (!subjectRaw) { console.error('[scrape-ncert] --subject is required'); process.exit(1) }
  const subject = SUBJECT_ALIASES[subjectRaw.toLowerCase().trim()]
  if (!subject) {
    console.error(`[scrape-ncert] Unknown subject "${subjectRaw}". Known: ${Object.keys(SUBJECT_ALIASES).join(', ')}`)
    process.exit(1)
  }

  return {
    grade,
    allGrades,
    subject,
    board: (flag('board') ?? 'cbse').toUpperCase(),
    lang:  (flag('lang')  ?? 'en').toLowerCase(),
    urlOverride: flag('url'),
    dryRun: argv.includes('--dry-run'),
  }
}

// ── URL resolution ────────────────────────────────────────────────────────────

function resolveDownloadUrl(args: Args, grade: number): string {
  if (args.urlOverride) return args.urlOverride
  const key = `${grade}-${args.subject}-${args.lang}`
  const stem = URL_TABLE[key]
  if (!stem) {
    console.error(
      `[scrape-ncert] No URL mapping for "${key}".\n` +
      `  Known keys: ${Object.keys(URL_TABLE).join(', ')}\n` +
      `  Use --url <direct-url> to override.`,
    )
    process.exit(1)
  }
  return `${BASE_URL}/${stem}.zip`
}

/** Return all grades available for a given subject+lang in URL_TABLE. */
function availableGrades(subject: string, lang: string): number[] {
  const prefix = `-${subject}-${lang}`
  return Object.keys(URL_TABLE)
    .filter((k) => k.endsWith(prefix))
    .map((k) => parseInt(k.split('-')[0], 10))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b)
}

// ── Download ──────────────────────────────────────────────────────────────────

async function verifyAndDownload(url: string, destPath: string): Promise<void> {
  console.log(`[scrape-ncert] Verifying ${url} …`)
  const headRes = await fetch(url, { method: 'HEAD' })
  if (!headRes.ok) {
    throw new Error(`HEAD ${url} → HTTP ${headRes.status}. URL may be wrong or NCERT server is down.`)
  }

  console.log(`[scrape-ncert] Downloading …`)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NCERT-scraper/1.0; educational-use)' },
  })
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`)

  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(destPath, buf)
  console.log(`[scrape-ncert] Downloaded ${(buf.length / 1024 / 1024).toFixed(1)} MB`)
}

// ── ZIP extraction ────────────────────────────────────────────────────────────

function extractZip(zipPath: string, destDir: string): void {
  try {
    execSync(`unzip -q "${zipPath}" -d "${destDir}"`, { stdio: 'pipe' })
  } catch (err: any) {
    const msg = String(err?.message ?? err)
    if (msg.includes('not found') || msg.includes('command not found')) {
      throw new Error('`unzip` not found on PATH. Install with: yum install unzip')
    }
    // unzip exits 1 for warnings (e.g. unsupported compression) but may still extract
    if (!fs.existsSync(destDir) || fs.readdirSync(destDir).length === 0) throw err
    console.warn('[scrape-ncert] unzip exited with warnings; continuing with extracted files.')
  }
}

function collectPdfs(dir: string): string[] {
  const found: string[] = []
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) found.push(full)
    }
  }
  walk(dir)
  return found.sort()
}

// ── PDF parsing ───────────────────────────────────────────────────────────────

async function parsePdf(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath)
  try {
    const data = await pdfParse(buf)
    return data.text
  } catch {
    // pdf-parse can throw on encrypted or malformed PDFs
    console.warn(`[scrape-ncert] pdf-parse failed for ${path.basename(filePath)}, skipping.`)
    return ''
  }
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    // Remove lines that are purely numeric (page numbers)
    .replace(/^\s*\d+\s*$/gm, '')
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, '\n\n')
    // Normalise horizontal whitespace
    .replace(/[^\S\n]+/g, ' ')
    .trim()
}

// ── Chunking ──────────────────────────────────────────────────────────────────

function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const slice = words.slice(i, i + CHUNK_WORDS)
    const chunk = slice.join(' ').trim()
    if (slice.length >= MIN_CHUNK_WORDS) chunks.push(chunk)
    i += CHUNK_WORDS - OVERLAP_WORDS
  }
  return chunks
}

// ── Hashing ───────────────────────────────────────────────────────────────────

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

// ── DB upsert ─────────────────────────────────────────────────────────────────

interface ChunkMeta { board: string; subject: string; grade: string }

interface ChunkToEmbed { id: string; content: string }

async function upsertChunks(
  prisma: PrismaClient,
  chunks: string[],
  meta: ChunkMeta,
): Promise<{ toEmbed: ChunkToEmbed[]; created: number; skipped: number }> {
  let created = 0
  let skipped = 0
  const toEmbed: ChunkToEmbed[] = []

  for (const content of chunks) {
    const contentHash = sha256(content)

    // Check if a chunk with this exact hash already exists and is embedded.
    // embedding is Unsupported("vector(1536)") so must use raw SQL.
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT id, (embedding IS NOT NULL) AS has_embedding
       FROM "CurriculumChunk"
       WHERE "contentHash" = $1
       LIMIT 1`,
      contentHash,
    )) as { id: string; has_embedding: boolean }[]

    if (rows.length > 0) {
      // Row exists: only re-embed if embedding is missing
      if (!rows[0].has_embedding) toEmbed.push({ id: rows[0].id, content })
      skipped++
    } else {
      // New chunk
      const row = await prisma.curriculumChunk.create({
        data: {
          content,
          contentHash,
          board: meta.board,
          subject: meta.subject,
          grade: meta.grade,
        },
        select: { id: true },
      })
      toEmbed.push({ id: row.id, content })
      created++
    }
  }

  return { toEmbed, created, skipped }
}

// ── Embedding ─────────────────────────────────────────────────────────────────

interface EmbedStats { embedded: number; errors: number; errorDetails: { id: string; error: string }[] }

async function embedChunks(prisma: PrismaClient, toEmbed: ChunkToEmbed[]): Promise<EmbedStats> {
  let embedded = 0
  let errors = 0
  const errorDetails: { id: string; error: string }[] = []

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE)
    const texts = batch.map((c) => c.content)
    const embeddings = await getEmbeddingsBatch(texts, BATCH_SIZE)

    for (let j = 0; j < batch.length; j++) {
      const embedding = embeddings[j]
      if (!embedding) {
        console.error(`[scrape-ncert] ✗ Embedding failed for chunk ${batch[j].id}`)
        errors++
        errorDetails.push({ id: batch[j].id, error: 'embedding_api_null' })
        continue
      }
      const vectorLiteral = `[${embedding.join(',')}]`
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "CurriculumChunk"
           SET embedding = $1::vector, "updatedAt" = NOW()
           WHERE id = $2`,
          vectorLiteral,
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

// ── IngestRunLog ──────────────────────────────────────────────────────────────

async function writeRunLog(
  prisma: PrismaClient,
  opts: {
    fileSource: string
    board: string
    chunksCreated: number
    chunksUpdated: number
    embeddingsGenerated: number
    errors: number
    startMs: number
    errorDetails?: unknown
  },
): Promise<void> {
  try {
    await prisma.ingestRunLog.create({
      data: {
        fileSource: opts.fileSource,
        board: opts.board,
        chunksCreated: opts.chunksCreated,
        chunksUpdated: opts.chunksUpdated,
        embeddingsGenerated: opts.embeddingsGenerated,
        errors: opts.errors,
        durationMs: Date.now() - opts.startMs,
        errorDetails: opts.errorDetails ? (opts.errorDetails as object) : undefined,
      },
    })
    console.log('[scrape-ncert] IngestRunLog written.')
  } catch (err) {
    console.warn('[scrape-ncert] Could not write IngestRunLog:', err)
  }
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

function cleanupTempDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // non-fatal
  }
}

// ── Per-grade pipeline ────────────────────────────────────────────────────────

async function runForGrade(
  prisma: PrismaClient,
  args: Args,
  grade: number,
): Promise<{ errors: number }> {
  const startMs = Date.now()
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ncert-'))

  console.log(
    `\n[scrape-ncert] ── grade=${grade} subject=${args.subject} board=${args.board} lang=${args.lang} ──`,
  )

  try {
    // ── Step 1: Download ──────────────────────────────────────────────────
    const downloadUrl = resolveDownloadUrl(args, grade)
    const zipPath = path.join(tmpDir, 'textbook.zip')
    await verifyAndDownload(downloadUrl, zipPath)

    // ── Step 2: Extract ───────────────────────────────────────────────────
    const extractDir = path.join(tmpDir, 'extracted')
    fs.mkdirSync(extractDir)
    extractZip(zipPath, extractDir)

    const pdfPaths = collectPdfs(extractDir)
    if (pdfPaths.length === 0) throw new Error('No PDF files found in ZIP.')
    console.log(
      `[scrape-ncert] Found ${pdfPaths.length} PDF file(s): ${pdfPaths.map((p) => path.basename(p)).join(', ')}`,
    )

    // ── Step 3: Parse + clean ─────────────────────────────────────────────
    const rawTexts: string[] = []
    for (const p of pdfPaths) {
      console.log(`[scrape-ncert] Parsing ${path.basename(p)} …`)
      const raw = await parsePdf(p)
      if (raw.trim()) rawTexts.push(cleanText(raw))
    }
    const combinedText = rawTexts.join('\n\n')
    console.log(`[scrape-ncert] Total text: ${combinedText.length.toLocaleString()} chars`)

    // ── Step 4: Chunk ─────────────────────────────────────────────────────
    const chunks = chunkText(combinedText)
    console.log(
      `[scrape-ncert] ${chunks.length} chunks at ~${CHUNK_WORDS} words / ${OVERLAP_WORDS}-word overlap`,
    )

    if (args.dryRun) {
      console.log(`[scrape-ncert] Dry run — would process ${chunks.length} chunks for grade ${grade}.`)
      return { errors: 0 }
    }

    // ── Step 5: Upsert CurriculumChunk rows ───────────────────────────────
    const meta: ChunkMeta = {
      board: args.board,
      subject: args.subject,
      grade: String(grade),
    }
    const { toEmbed, created, skipped } = await upsertChunks(prisma, chunks, meta)
    console.log(`[scrape-ncert] Chunks: ${created} created, ${skipped} skipped (hash match)`)

    // ── Step 6: Embed ─────────────────────────────────────────────────────
    let embeds = { embedded: 0, errors: 0, errorDetails: [] as { id: string; error: string }[] }
    if (toEmbed.length > 0) {
      console.log(`[scrape-ncert] Embedding ${toEmbed.length} chunk(s) …`)
      embeds = await embedChunks(prisma, toEmbed)
      console.log(`[scrape-ncert] Embedded: ${embeds.embedded}, Errors: ${embeds.errors}`)
    } else {
      console.log('[scrape-ncert] All chunks already embedded — nothing to do.')
    }

    // ── Step 7: IngestRunLog ──────────────────────────────────────────────
    await writeRunLog(prisma, {
      fileSource: downloadUrl,
      board: args.board,
      chunksCreated: created,
      chunksUpdated: 0,
      embeddingsGenerated: embeds.embedded,
      errors: embeds.errors,
      startMs,
      errorDetails: embeds.errorDetails.length > 0 ? embeds.errorDetails : undefined,
    })

    const durationSec = ((Date.now() - startMs) / 1000).toFixed(1)
    console.log(
      `[scrape-ncert] ✓ grade ${grade} done in ${durationSec}s — ` +
        `${chunks.length} chunks, ${embeds.embedded} embedded, ${embeds.errors} errors.`,
    )

    return { errors: embeds.errors }
  } finally {
    cleanupTempDir(tmpDir)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs()
  if (args.dryRun) console.log('[scrape-ncert] DRY RUN — no DB writes.')

  const grades: number[] = args.allGrades
    ? availableGrades(args.subject, args.lang)
    : [args.grade as number]

  if (grades.length === 0) {
    console.error(
      `[scrape-ncert] No grades available for subject="${args.subject}" lang="${args.lang}" in URL_TABLE.`,
    )
    process.exit(1)
  }

  if (args.allGrades) {
    console.log(`[scrape-ncert] --all-grades: will process grades ${grades.join(', ')} for ${args.subject}`)
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
