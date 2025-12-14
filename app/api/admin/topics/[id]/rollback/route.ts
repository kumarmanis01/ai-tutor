import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  await prisma.topicDef.update({
    where: { id: params.id },
    data: { lifecycle: "deleted" },
  })

  return NextResponse.json({ success: true })
}
