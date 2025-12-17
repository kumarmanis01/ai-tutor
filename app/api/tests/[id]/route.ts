import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: any) {
  const test = await prisma.generatedTest.findUnique({ where: { id: params.id } });
  return NextResponse.json(test);
}

export async function PUT(req: Request, { params }: any) {
  const data = await req.json();
  const test = await prisma.generatedTest.update({ where: { id: params.id }, data });
  return NextResponse.json(test);
}

export async function DELETE(req: Request, { params }: any) {
  // Soft delete: mark lifecycle as deleted instead of hard delete
  await prisma.generatedTest.update({ where: { id: params.id }, data: { lifecycle: 'deleted' } });
  return NextResponse.json({ success: true });
}
