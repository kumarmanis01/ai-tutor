import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { reason } = await req.json()

  const chapter = await prisma.chapterDef.findFirst({
    where: { id: params.id, lifecycle: "active" },
  })

  if (!chapter) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.$transaction([
    prisma.chapterDef.update({
      where: { id: params.id },
      data: { status: "rejected" },
    }),
    prisma.approvalAudit.create({
      data: {
        entityType: "chapter",
        entityId: params.id,
        fromStatus: chapter.status,
        toStatus: "rejected",
        reason,
      },
    }),
  ])

  return NextResponse.json({ success: true })
}
