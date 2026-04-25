/**
 * FILE OBJECTIVE:
 * - CLI utility to parse a local PDF and upsert CurriculumChunk rows (idempotent).
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/parse-pdf-cli.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | copilot | created CLI to parse local PDF and write CurriculumChunk rows
 */

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

const CHUNK_WORDS = 400;
const OVERLAP_WORDS = 50;

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const slice = words.slice(i, i + CHUNK_WORDS);
    if (slice.length > 10) chunks.push(slice.join(' '));
    i += CHUNK_WORDS - OVERLAP_WORDS;
  }
  return chunks;
}

async function main() {
  const argv = process.argv.slice(2);
  function flag(name: string) {
    const i = argv.indexOf(`--${name}`);
    return i !== -1 ? (argv[i + 1] ?? null) : null;
  }

  const filePath = flag('file');
  if (!filePath) {
    console.error(
      'Usage: node ingest.js --file <path> --board CBSE --subject <subjectId|slug> --grade <grade> [--lang en]'
    );
    process.exit(1);
  }

  const board = flag('board') ?? 'CBSE';
  const subject = flag('subject') ?? null;
  const grade = flag('grade') ?? null;
  const lang = flag('lang') ?? 'en';

  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(1);
  }

  let buf: Buffer;
  try {
    buf = fs.readFileSync(abs);
  } catch (e) {
    console.error('Failed to read file:', e);
    process.exit(1);
  }

  // Dynamic import pdf-parse to avoid hard dependency at runtime if not needed
  let text = '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
    const pdfParse = (await import('pdf-parse')).default as (
      buf: Buffer
    ) => Promise<{ text: string }>;
    const data = await pdfParse(buf);
    text = String(data.text ?? '');
  } catch (e) {
    console.warn('pdf-parse not available or failed; falling back to naive text extraction');
    text = buf.toString('latin1');
  }

  const textChunks = chunkText(text);
  if (textChunks.length === 0) {
    console.error('No text extracted from PDF');
    process.exit(1);
  }

  let chunksCreated = 0;
  let chunksSkipped = 0;
  let embeddingsPending = 0;
  let errors = 0;

  for (const chunkTextStr of textChunks) {
    const hash = sha256(chunkTextStr);
    try {
      const existing = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "CurriculumChunk" WHERE "contentHash" = ${hash} LIMIT 1
      `;
      if (existing.length > 0) {
        chunksSkipped++;
        continue;
      }

      await prisma.curriculumChunk.create({
        data: {
          content: chunkTextStr,
          contentHash: hash,
          board,
          subject: subject ?? undefined,
          grade: grade ?? undefined,
          version: 1,
        },
      });
      chunksCreated++;
      embeddingsPending++;
    } catch (err) {
      console.error('chunk upsert error:', err);
      errors++;
    }
  }

  try {
    await prisma.ingestRunLog.create({
      data: {
        fileSource: path.basename(abs),
        board,
        subjectId: subject ?? undefined,
        chunksCreated,
        chunksUpdated: 0,
        embeddingsGenerated: 0,
        errors,
        durationMs: 0,
      },
    });
  } catch (e) {
    console.warn('Could not write IngestRunLog:', e);
  }

  console.log(
    `Done. created=${chunksCreated} skipped=${chunksSkipped} pendingEmbeds=${embeddingsPending} errors=${errors}`
  );
  await prisma.$disconnect();
  if (errors > 0) process.exit(1);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
  });
}
