import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const adminId = "SYSTEM_ADMIN" // replace with session.user.id

  const chapter = await prisma.chapterDef.findFirst({
    where: {
      id: params.id,
      lifecycle: "active",
    },
  })

  if (!chapter) {
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 })
  }

  if (chapter.status === "approved") {
    return NextResponse.json({ message: "Already approved" })
  }

  await prisma.$transaction([
    prisma.chapterDef.update({
      where: { id: params.id },
      data: { status: "approved" },
    }),
    prisma.approvalAudit.create({
      data: {
        entityType: "chapter",
        entityId: params.id,
        fromStatus: chapter.status,
        toStatus: "approved",
        actorId: adminId,
      },
    }),
  ])

  return NextResponse.json({ success: true })
}
