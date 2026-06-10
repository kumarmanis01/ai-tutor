/**
 * FILE OBJECTIVE:
 * - POST /api/admin/concepts/generate: AI-powered generation of TopicConcept rows for
 *   a given board/grade/subject/language/chapter. Validates input with Zod, generates a
 *   URL-safe slug per concept, and upserts rows so re-running is fully idempotent.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | add Zod validation, concept slug, language support, idempotent upsert
 * - 2026-06-09T00:00:00Z | claude | initial implementation for admin concept seeder
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { GenerateConceptsSchema } from '@/lib/validators/concepts';
import OpenAI from 'openai';

// ─── Lazy OpenAI singleton ────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConceptItem {
  title: string;
  summary: string;
  orderIndex: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(
  board: string,
  grade: string,
  subject: string,
  language: string,
  chapterTitle: string,
  count: number,
): string {
  const langNote = language !== 'en'
    ? `\nNote: The student interface is in ${language} but concept titles and summaries should be in English for curriculum consistency.`
    : '';
  return `You are an expert curriculum designer for Indian school education.

Generate exactly ${count} key concepts for the following chapter:

Board: ${board}
Grade: ${grade}
Subject: ${subject}
Chapter: ${chapterTitle}${langNote}

For each concept provide:
- title: A short, precise concept name (3-8 words)
- summary: A short description -- one clear sentence (max 25 words) explaining what this concept is and why it matters to the student
- orderIndex: Integer starting at 1, ordered from foundational to advanced

Respond ONLY with a JSON array. No markdown, no explanation. Example:
[
  { "title": "Concept Name", "summary": "Short description of what this concept is and why it matters.", "orderIndex": 1 }
]`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = GenerateConceptsSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { board, grade, subject, language, topicSlug, chapterTitle, count } = parsed.data;

  const prompt = buildPrompt(board, grade, subject, language, chapterTitle, count);

  let rawJson: string;
  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1600,
    });
    rawJson = completion.choices[0]?.message?.content ?? '[]';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('admin.concepts.generate.openai', { board, grade, subject, topicSlug, error: msg });
    return NextResponse.json({ error: 'ai_failed' }, { status: 502 });
  }

  let concepts: ConceptItem[];
  try {
    const stripped = rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed: unknown = JSON.parse(stripped);
    if (!Array.isArray(parsed)) throw new Error('not an array');
    concepts = (parsed as Record<string, unknown>[])
      .map((item, i) => ({
        title: String(item.title ?? ''),
        summary: String(item.summary ?? ''),
        orderIndex: Number(item.orderIndex ?? i + 1),
      }))
      .filter((c) => c.title && c.summary);
  } catch (err: unknown) {
    logger.error('admin.concepts.generate.parse', { rawJson, error: String(err) });
    return NextResponse.json({ error: 'parse_failed', raw: rawJson }, { status: 502 });
  }

  // Upsert each concept by the existing title-based unique key; populate slug on every run.
  let created = 0;
  let updated = 0;
  const upsertedConcepts = await Promise.all(
    concepts.map(async (c) => {
      const conceptSlug = slugify(c.title);
      const row = {
        topicSlug,
        subject,
        grade,
        board,
        language,
        title: c.title,
        slug: conceptSlug,
        summary: c.summary,
        orderIndex: c.orderIndex,
      };
      const existing = await prisma.topicConcept.findFirst({
        where: { topicSlug, subject, grade, board, title: c.title },
        select: { id: true },
      });
      if (existing) {
        await prisma.topicConcept.update({
          where: { id: existing.id },
          data: { slug: conceptSlug, summary: c.summary, orderIndex: c.orderIndex, language },
        });
        updated += 1;
      } else {
        await prisma.topicConcept.create({ data: row });
        created += 1;
      }
      return { ...c, slug: conceptSlug };
    }),
  );

  logger.info('admin.concepts.generated', {
    board,
    grade,
    subject,
    language,
    topicSlug,
    requested: count,
    created,
    updated,
  });

  return NextResponse.json({ ok: true, created, updated, concepts: upsertedConcepts });
}
