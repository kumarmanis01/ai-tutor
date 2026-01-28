import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertNoStringFilters } from "@/lib/guards/noStringFilters";
import { logger } from "@/lib/logger";
import { formatErrorForResponse } from '@/lib/errorResponse';

export async function GET(req: Request) {
  try {
    // Runtime guard: reject string-based filters that leak identity
    try {
      assertNoStringFilters(req);
    } catch (e) {
      return NextResponse.json({ error: formatErrorForResponse(e) }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get("boardId");

    if (!boardId) {
      return NextResponse.json({ error: "boardId required" }, { status: 400 });
    }

    const classes = await prisma.classLevel.findMany({
      where: { boardId },
      orderBy: { grade: "asc" },
    });

    return NextResponse.json(classes);
  } catch (err) {
    logger.error('/api/classes error', { error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Basic validation: require boardId and grade
    const { boardId, grade, slug } = body;
    if (!boardId || typeof boardId !== "string") {
      return NextResponse.json({ error: "boardId required" }, { status: 400 });
    }
    if (grade === undefined || typeof grade !== "number") {
      return NextResponse.json({ error: "grade (number) required" }, { status: 400 });
    }

    const data: any = { boardId, grade, slug: slug || String(grade) };

    const cls = await prisma.classLevel.create({ data });
    return NextResponse.json(cls);
  } catch (err) {
    logger.error('/api/classes POST error', { error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
