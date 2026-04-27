import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertNoStringFilters } from "@/lib/guards/noStringFilters";
import { logger } from "@/lib/logger";
import { formatErrorForResponse } from '@/lib/errorResponse';

export async function GET(req: Request) {
  try {
    try {
      assertNoStringFilters(req);
    } catch (e) {
      return NextResponse.json({ error: formatErrorForResponse(e) }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const chapterId = searchParams.get("chapterId");
    const subjectId = searchParams.get("subjectId");

    if (!chapterId && !subjectId) {
      return NextResponse.json({ error: "chapterId or subjectId required" }, { status: 400 });
    }

    let topics;
    if (chapterId) {
      topics = await prisma.topicDef.findMany({ where: { chapterId, lifecycle: "active" }, orderBy: { order: "asc" } });
    } else {
      // subjectId path: include topics across chapters for the subject
      const chapterWhere: any = { lifecycle: 'active' };
      if (subjectId) chapterWhere.subjectId = subjectId;
      topics = await prisma.topicDef.findMany({ where: { chapter: chapterWhere }, orderBy: { order: 'asc' } });
    }

    return NextResponse.json(topics);
  } catch (err) {
    logger.error('/api/topics error', { error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const topic = await prisma.topicDef.create({ data });
    return NextResponse.json(topic);
  } catch (err) {
    logger.error('/api/topics POST error', { error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
