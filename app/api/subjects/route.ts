import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertNoStringFilters } from "@/lib/guards/noStringFilters";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  try {
    try {
      assertNoStringFilters(req);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");

    if (!classId) {
      return NextResponse.json({ error: "classId required" }, { status: 400 });
    }

    const subjects = await prisma.subjectDef.findMany({
      where: { classId },
      include: { chapters: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(subjects);
  } catch (err) {
    logger.error(`/api/subjects error: ${String(err)}`);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const subject = await prisma.subjectDef.create({ data });
    return NextResponse.json(subject);
  } catch (err) {
    logger.error(`/api/subjects POST error: ${String(err)}`);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
