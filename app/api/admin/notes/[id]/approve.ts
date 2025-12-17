import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSessionForHandlers } from '@/lib/session';
import { ApprovalStatus } from '@/lib/ai-engine/types';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSessionForHandlers();
  const adminId = session?.user?.id ?? 'SYSTEM_ADMIN';

  const note = await prisma.topicNote.findUnique({ where: { id: params.id } });
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.topicNote.update({ where: { id: params.id }, data: { status: ApprovalStatus.Approved } }),
    prisma.auditLog.create({ data: { userId: adminId, action: 'approve_note', details: { noteId: params.id, fromStatus: note.status }, createdAt: new Date() } })
  ]);

  return NextResponse.json({ approved: true });
}
