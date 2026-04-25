import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { reason } = await req.json();

  const chapter = await prisma.chapterDef.findFirst({
    where: { id, lifecycle: 'active' },
  });

  if (!chapter) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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
      where: { id },
      data: { status: 'rejected' },
    }),
    prisma.approvalAudit.create({
      data: {
        entityType: 'chapter',
        entityId: id,
        fromStatus: chapter.status,
        toStatus: 'rejected',
        reason,
      },
    }),
    prisma.auditLog.create({
      data: {
        adminId,
        targetEntity: 'ChapterDef',
        targetId: id,
        action: 'CONTENT_REJECT',
        previousValue: { status: chapter.status },
        newValue: { status: 'rejected' },
        reason: reason ?? null,
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}
