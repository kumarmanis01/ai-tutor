import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const topics = await prisma.topicDef.findMany({});
  return NextResponse.json(topics);
}

export async function POST(req: Request) {
  const data = await req.json();
  const topic = await prisma.topicDef.create({ data });
  return NextResponse.json(topic);
}
