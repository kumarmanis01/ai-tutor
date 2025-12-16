import { NextRequest, NextResponse } from "next/server";
import Tesseract from "tesseract.js";
import { logger } from '@/lib/logger';

// Simple heuristics to extract heading-like lines and map to catalog items
function extractHeadingsToItems(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const headingCandidates = lines.filter((l) => {
    const isShort = l.length <= 120;
    const hasFewPunct = (l.match(/[.;:,!?]/g)?.length || 0) <= 2;
    const titleCaseLike = /\b([A-Z][a-z]+\s+){1,6}[A-Z][a-z]+\b/.test(l) || /Chapter\s+\d+/i.test(l) || /Unit\s+\d+/i.test(l);
    return isShort && hasFewPunct && titleCaseLike;
  });

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const unique = headingCandidates.filter((h) => {
    const key = h.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Map to minimal catalog entries; board/grade/subject/language are provided by client defaults
  const items = unique.map((title, idx) => ({
    title,
    type: "chapter",
    order: idx + 1,
  }));
  return items;
}

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const defaultsRaw = formData.get("defaults");

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }

    // Optional defaults: { board, grade, subject, language }
    let defaults: Record<string, string | number | undefined> = {};
    if (typeof defaultsRaw === "string" && defaultsRaw.length) {
      try {
        defaults = JSON.parse(defaultsRaw);
      } catch {
        // ignore
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await Tesseract.recognize(buffer, (defaults.language as string) || "eng", {
      logger: () => {},
    });

    const text = result.data?.text || "";
    // Build hierarchical taxonomy structure (Board > Class > Subject > Chapter > Topic)
    const board = String(defaults.board || 'CBSE');
    const grade = String(defaults.grade || '6');
    const subject = String(defaults.subject || 'Mathematics');
    const language = String(defaults.language || 'en');
    const headings = extractHeadingsToItems(text);
    const chapters = headings.map((item, idx) => ({
      id: `chapter-${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: item.title,
      slug: item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      order: idx + 1,
      topics: [],
    }));
    const taxonomy = {
      board: { id: board.toLowerCase(), name: board, slug: board.toLowerCase() },
      class: { id: `class-${grade}`, name: `Class ${grade}`, slug: `class-${grade}`, board_id: board.toLowerCase() },
      subject: { id: subject.toLowerCase(), name: subject, slug: subject.toLowerCase(), class_id: `class-${grade}` },
      chapters,
      language,
    };
    // Log taxonomy JSON to the centralized logger for inspection
    logger.info('[PARSE-IMAGE TAXONOMY] ' + JSON.stringify(taxonomy, null, 2));
    return NextResponse.json({ ok: true, message: 'Taxonomy logged to server logger.' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to parse image" }, { status: 500 });
  }
}
