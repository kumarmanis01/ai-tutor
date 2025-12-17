import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: any) {
  const subject = await prisma.subjectDef.findUnique({ where: { id: params.id } });
  return NextResponse.json(subject);
}

export async function PUT(req: Request, { params }: any) {
  const data = await req.json();
  const subject = await prisma.subjectDef.update({ where: { id: params.id }, data });
  return NextResponse.json(subject);
}

export async function DELETE(req: Request, { params }: any) {
  await prisma.subjectDef.update({ where: { id: params.id }, data: { lifecycle: 'deleted' } });
  return NextResponse.json({ success: true });
}
