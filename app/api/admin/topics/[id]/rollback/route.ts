import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.topicDef.update({
    where: { id },
    data: { lifecycle: "deleted" },
  })

  return NextResponse.json({ success: true })
}
