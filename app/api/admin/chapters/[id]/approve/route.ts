import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ApprovalStatus } from '@/lib/ai-engine/types'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Resolve session identity to canonical DB user id for audit safety
  const session = await (await import('@/lib/session')).getServerSessionForHandlers();
  const role = (session?.user as any)?.role ?? null;
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  let adminId: string | null = null;
  try {
    if (session?.user?.id) {
      const byId = await (await import('@/lib/prisma')).prisma.user.findUnique({ where: { id: session.user.id } });
      if (byId) adminId = byId.id;
    }
    if (!adminId && session?.user?.email) {
      const byEmail = await (await import('@/lib/prisma')).prisma.user.findUnique({ where: { email: session.user.email } });
      if (byEmail) adminId = byEmail.id;
    }
  } catch {
    adminId = null;
  }

  const chapter = await prisma.chapterDef.findFirst({
    where: {
      id,
      lifecycle: "active",
    },
  })

  if (!chapter) {
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 })
  }

  if (chapter.status === ApprovalStatus.Approved) {
    return NextResponse.json({ message: "Already approved" })
  }

  await prisma.$transaction([
    prisma.chapterDef.update({
      where: { id },
      data: { status: "approved" },
    }),
    prisma.approvalAudit.create({
      data: {
        entityType: "chapter",
        entityId: id,
        fromStatus: chapter.status,
        toStatus: "approved",
        actorId: adminId,
      },
    }),
    prisma.auditLog.create({ data: { adminId, targetEntity: 'ChapterDef', targetId: id, action: 'CONTENT_APPROVE', previousValue: { status: chapter.status }, newValue: { status: 'approved' } } })
  ])

  return NextResponse.json({ success: true })
}
