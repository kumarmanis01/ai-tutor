import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  await prisma.generatedTest.update({
    where: { id: params.id },
    data: { lifecycle: "deleted" },
  });
  return NextResponse.json({ unpublished: true });
}
