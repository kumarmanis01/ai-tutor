import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

// Run with: ts-node scripts/seed-catalog.ts <file.jsonl|file.json>
async function main() {
  const file = process.argv[2];
  if (!file) { console.error('Usage: ts-node scripts/seed-catalog.ts <file.jsonl|file.json>'); process.exit(1); }
  const full = path.resolve(file);
  const text = fs.readFileSync(full, 'utf8');
  let items: any[] = [];
  try {
    const arr = JSON.parse(text);
    if (Array.isArray(arr)) items = arr;
  } catch {
    items = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as any[];
  }
  let upserted = 0;
  for (const item of items) {
    const required = ['contentId','title','subject','board','grade','language'];
    const missing = required.filter((k) => !item[k] || String(item[k]).trim() === '');
    if (missing.length) { console.warn(`skip ${item.contentId || 'unknown'} missing: ${missing.join(',')}`); continue; }
    const contentId = String(item.contentId);
    const title = String(item.title);
    const description = item.description ? String(item.description) : null;
    const url = item.url ? String(item.url) : null;
    const type = item.type ? String(item.type) : null;
    const subject = String(item.subject);
    const board = String(item.board);
    const grade = String(item.grade);
    const language = String(item.language);
    const difficulty = item.difficulty ? String(item.difficulty) : null;
    const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
    const active = item.active == null ? true : !!item.active;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "ContentCatalog" ("contentId","title","description","url","type","subject","board","grade","language","difficulty","tags","active","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW(), NOW())
       ON CONFLICT ("contentId") DO UPDATE SET 
         "title" = EXCLUDED."title",
         "description" = EXCLUDED."description",
         "url" = EXCLUDED."url",
         "type" = EXCLUDED."type",
         "subject" = EXCLUDED."subject",
         "board" = EXCLUDED."board",
         "grade" = EXCLUDED."grade",
         "language" = EXCLUDED."language",
         "difficulty" = EXCLUDED."difficulty",
         "tags" = EXCLUDED."tags",
         "active" = EXCLUDED."active",
         "updatedAt" = NOW()`,
      contentId, title, description, url, type, subject, board, grade, language, difficulty, tags, active,
    );
    upserted++;
  }
  console.log(`Upserted ${upserted} catalog entries.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
