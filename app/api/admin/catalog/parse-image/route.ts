import { NextRequest, NextResponse } from "next/server";
import Tesseract from "tesseract.js";

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
    const items = extractHeadingsToItems(text).map((item) => ({
      ...item,
      board: defaults.board,
      grade: defaults.grade,
      subject: defaults.subject,
      language: defaults.language || "en",
      source: "image-ocr",
    }));

    return NextResponse.json({ items }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to parse image" }, { status: 500 });
  }
}
