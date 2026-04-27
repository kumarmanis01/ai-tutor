import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

// Accepts JSONL or JSON array body with ContentCatalog-like entries
export async function POST(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  const role = (session?.user as any)?.role || 'user';
  if (role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  let items: any[] = [];
  try {
    const text = await req.text();
    // Try JSON array first
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) items = arr;
    } catch {
      // Parse JSONL
      items = text
        .split(/\r?\n/) 
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          try { return JSON.parse(line); } catch { return null; }
        })
        .filter(Boolean) as any[];
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body', message: 'Provide JSON array or JSONL' }, { status: 400 });
  }

  const results = { upserted: 0, errors: [] as string[] };
  for (const item of items) {
    const required = ['contentId','title','subject','board','grade','language'];
    const missing = required.filter((k) => !item[k] || String(item[k]).trim() === '');
    if (missing.length) { results.errors.push(`missing fields for ${item.contentId || 'unknown'}: ${missing.join(',')}`); continue; }
    try {
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
      results.upserted++;
    } catch (e: any) {
      results.errors.push(`${item.contentId}: ${String(e?.message || e)}`);
    }
  }

  return NextResponse.json(results);
}
