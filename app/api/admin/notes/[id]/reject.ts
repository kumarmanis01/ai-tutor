import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getServerSessionForHandlers } from '@/lib/session';
import { ApprovalStatus } from '@/lib/ai-engine/types';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { reason } = await req.json();
  if (reason) logger.add(`Note rejected for reason: ${reason}`);

  const session = await getServerSessionForHandlers();
  const adminId = session?.user?.id ?? 'SYSTEM_ADMIN';

  const note = await prisma.topicNote.findUnique({ where: { id: params.id } });
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.topicNote.update({ where: { id: params.id }, data: { status: ApprovalStatus.Rejected } }),
    prisma.auditLog.create({ data: { userId: adminId, action: 'reject_note', details: { noteId: params.id, reason, fromStatus: note.status }, createdAt: new Date() } })
  ]);

  return NextResponse.json({ rejected: true });
}
