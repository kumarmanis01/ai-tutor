import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const notes = await prisma.note.findMany({});
  return NextResponse.json(notes);
}

export async function POST(req: Request) {
  const data = await req.json();
  const note = await prisma.note.create({ data });
  return NextResponse.json(note);
}
