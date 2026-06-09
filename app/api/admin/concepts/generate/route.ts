/**
 * FILE OBJECTIVE:
 * - POST /api/admin/concepts/generate: AI-powered generation of TopicConcept rows for
 *   a given board/grade/subject/chapter. Saves directly to the TopicConcept table with
 *   skipDuplicates so the route is safe to call multiple times.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial implementation for admin concept seeder
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
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

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(board: string, grade: string, subject: string, chapterTitle: string, count: number): string {
  return `You are an expert curriculum designer for Indian school education.

Generate exactly ${count} key concepts for the following chapter:

Board: ${board}
Grade: ${grade}
Subject: ${subject}
Chapter: ${chapterTitle}

For each concept provide:
- title: A short, precise concept name (3-8 words)
- summary: One clear sentence (max 25 words) describing what this concept is and why it matters
- orderIndex: Integer starting at 1, ordered from foundational to advanced

Respond ONLY with a JSON array. No markdown, no explanation. Example:
[
  { "title": "Concept Name", "summary": "Clear one-sentence description of the concept.", "orderIndex": 1 }
]`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { board, grade, subject, topicSlug, chapterTitle, count } = body as Record<string, unknown>;

  if (!board || !grade || !subject || !topicSlug || !chapterTitle) {
    return NextResponse.json(
      { error: 'missing_fields', required: ['board', 'grade', 'subject', 'topicSlug', 'chapterTitle'] },
      { status: 400 },
    );
  }

  const conceptCount = typeof count === 'number' && count >= 1 && count <= 20 ? count : 5;

  const prompt = buildPrompt(
    String(board),
    String(grade),
    String(subject),
    String(chapterTitle),
    conceptCount,
  );

  let rawJson: string;
  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1200,
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
    concepts = parsed.map((item, i) => ({
      title: String((item as Record<string, unknown>).title ?? ''),
      summary: String((item as Record<string, unknown>).summary ?? ''),
      orderIndex: Number((item as Record<string, unknown>).orderIndex ?? i + 1),
    })).filter((c) => c.title && c.summary);
  } catch (err: unknown) {
    logger.error('admin.concepts.generate.parse', { rawJson, error: String(err) });
    return NextResponse.json({ error: 'parse_failed', raw: rawJson }, { status: 502 });
  }

  const rows = concepts.map((c) => ({
    topicSlug: String(topicSlug),
    subject: String(subject),
    grade: String(grade),
    board: String(board),
    title: c.title,
    summary: c.summary,
    orderIndex: c.orderIndex,
  }));

  const result = await prisma.topicConcept.createMany({ data: rows, skipDuplicates: true });

  logger.info('admin.concepts.generated', {
    board,
    grade,
    subject,
    topicSlug,
    requested: conceptCount,
    created: result.count,
  });

  return NextResponse.json({ ok: true, created: result.count, concepts });
}
