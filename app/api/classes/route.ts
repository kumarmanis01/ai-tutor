import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const classes = await prisma.classLevel.findMany({ include: { subjects: true } });
  return NextResponse.json(classes);
}

export async function POST(req: Request) {
  const data = await req.json();
  const cls = await prisma.classLevel.create({ data });
  return NextResponse.json(cls);
}
