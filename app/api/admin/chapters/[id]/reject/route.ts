import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSessionForHandlers } from '@/lib/session';
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { reason } = await req.json()

  const chapter = await prisma.chapterDef.findFirst({
    where: { id: params.id, lifecycle: "active" },
  })

  if (!chapter) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const session = await getServerSessionForHandlers();
  // Resolve canonical DB user id for audit safety; fall back to null
  let adminId: string | null = null;
  try {
    if (session?.user?.id) {
      const byId = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (byId) adminId = byId.id;
    }
    if (!adminId && session?.user?.email) {
      const byEmail = await prisma.user.findUnique({ where: { email: session.user.email } });
      if (byEmail) adminId = byEmail.id;
    }
  } catch {
    adminId = null;
  }

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
    prisma.auditLog.create({ data: { userId: adminId, action: 'reject_chapter', details: { chapterId: params.id, reason, fromStatus: chapter.status }, createdAt: new Date() } })
  ])

  return NextResponse.json({ success: true })
}
