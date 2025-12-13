import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const subjects = await prisma.subjectDef.findMany({ include: { chapters: true } });
  return NextResponse.json(subjects);
}

export async function POST(req: Request) {
  const data = await req.json();
  const subject = await prisma.subjectDef.create({ data });
  return NextResponse.json(subject);
}
