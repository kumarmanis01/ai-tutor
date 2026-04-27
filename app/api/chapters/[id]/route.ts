import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: any) {
  const chapter = await prisma.chapterDef.findUnique({ where: { id: params.id } });
  return NextResponse.json(chapter);
}

export async function PUT(req: Request, { params }: any) {
  const data = await req.json();
  const chapter = await prisma.chapterDef.update({ where: { id: params.id }, data });
  return NextResponse.json(chapter);
}

export async function DELETE(req: Request, { params }: any) {
  await prisma.chapterDef.update({ where: { id: params.id }, data: { lifecycle: 'deleted' } });
  return NextResponse.json({ success: true });
}
