import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: any) {
  const note = await prisma.note.findUnique({ where: { id: params.id } });
  return NextResponse.json(note);
}

export async function PUT(req: Request, { params }: any) {
  const data = await req.json();
  const note = await prisma.note.update({ where: { id: params.id }, data });
  return NextResponse.json(note);
}

export async function DELETE(req: Request, { params }: any) {
  await prisma.note.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
