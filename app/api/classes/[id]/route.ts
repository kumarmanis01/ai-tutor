import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: any) {
  const cls = await prisma.classLevel.findUnique({ where: { id: params.id } });
  return NextResponse.json(cls);
}

export async function PUT(req: Request, { params }: any) {
  const data = await req.json();
  const cls = await prisma.classLevel.update({ where: { id: params.id }, data });
  return NextResponse.json(cls);
}

export async function DELETE(req: Request, { params }: any) {
  await prisma.classLevel.update({ where: { id: params.id }, data: { lifecycle: 'deleted' } });
  return NextResponse.json({ success: true });
}
