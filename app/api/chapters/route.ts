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
      // Log the error using the project's logger utility
      logger.error("Invalid string filters in chapters GET request", {
        error: e,
        req,
      });
      return NextResponse.json({ error: formatErrorForResponse(e) }, { status: 400 });
    }

    const chapters = await prisma.chapterDef.findMany({ include: { topics: true } });
    return NextResponse.json(chapters);
  } catch (error) {
    // Log the error using the project's logger utility
    logger.error("Failed to fetch chapters", {
      error,
      req,
    });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const data = await req.json();
  const chapter = await prisma.chapterDef.create({ data });
  return NextResponse.json(chapter);
}
