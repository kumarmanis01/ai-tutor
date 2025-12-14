import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await prisma.generatedTest.update({
    where: { id: params.id },
    data: { status: "approved" },
  });
  return NextResponse.json({ approved: true });
}
