import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertNoStringFilters } from "@/lib/guards/noStringFilters";
import { logger } from "@/lib/logger";

// GET all boards
export async function GET(req: Request) {
  try {
    try {
      assertNoStringFilters(req);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
    }

    const boards = await prisma.board.findMany({ include: { classes: true } });
    return NextResponse.json(boards);
  } catch (err) {
    logger.error('GET /api/boards error', { err });
    return new NextResponse(JSON.stringify({ error: 'Service temporarily unavailable' }), { status: 503 });
  }
}

// CREATE a board
export async function POST(req: Request) {
  try {
    const data = await req.json();
    const board = await prisma.board.create({ data });
    return NextResponse.json(board);
  } catch (err) {
    logger.error('POST /api/boards error', { err });
    return new NextResponse(JSON.stringify({ error: 'Service temporarily unavailable' }), { status: 503 });
  }
}
