import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const chapters = await prisma.chapterDef.findMany({ include: { topics: true } });
  return NextResponse.json(chapters);
}

export async function POST(req: Request) {
  const data = await req.json();
  const chapter = await prisma.chapterDef.create({ data });
  return NextResponse.json(chapter);
}
