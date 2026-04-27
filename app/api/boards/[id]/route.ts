import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: any) {
  const board = await prisma.board.findUnique({
    where: { id: params.id },
  });
  return NextResponse.json(board);
}

export async function PUT(req: Request, { params }: any) {
  const data = await req.json();
  const board = await prisma.board.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(board);
}

export async function DELETE(req: Request, { params }: any) {
  await prisma.board.update({ where: { id: params.id }, data: { lifecycle: 'deleted' } });
  return NextResponse.json({ success: true });
}
