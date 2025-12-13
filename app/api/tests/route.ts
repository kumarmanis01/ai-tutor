import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tests = await prisma.generatedTest.findMany({});
  return NextResponse.json(tests);
}

export async function POST(req: Request) {
  const data = await req.json();
  const test = await prisma.generatedTest.create({ data });
  return NextResponse.json(test);
}
