import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: any) {
  const topic = await prisma.topicDef.findUnique({ where: { id: params.id } });
  return NextResponse.json(topic);
}

export async function PUT(req: Request, { params }: any) {
  const data = await req.json();
  const topic = await prisma.topicDef.update({ where: { id: params.id }, data });
  return NextResponse.json(topic);
}

export async function DELETE(req: Request, { params }: any) {
  await prisma.topicDef.update({ where: { id: params.id }, data: { lifecycle: 'deleted' } });
  return NextResponse.json({ success: true });
}
