import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all boards
export async function GET() {
  const boards = await prisma.board.findMany({
    include: { classes: true },
  });
  return NextResponse.json(boards);
}

// CREATE a board
export async function POST(req: Request) {
  const data = await req.json();
  const board = await prisma.board.create({ data });
  return NextResponse.json(board);
}
