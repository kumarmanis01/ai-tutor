import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getServerSessionForHandlers } from '@/lib/session';
import { ApprovalStatus } from '@/lib/ai-engine/types';
import { enqueueNotesHydration } from '@/lib/execution-pipeline/enqueueTopicHydration';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { reason } = await req.json();
  if (reason) logger.add(`Note rejected for reason: ${reason}`);

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

  const note = await prisma.topicNote.findUnique({ where: { id: params.id } });
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.topicNote.update({ where: { id: params.id }, data: { status: ApprovalStatus.Rejected } }),
    prisma.auditLog.create({ data: { userId: adminId, action: 'reject_note', details: { noteId: params.id, reason, fromStatus: note.status }, createdAt: new Date() } })
  ]);

  // Auto-regenerate: enqueue a new notes hydration job for this topic
  if (note.topicId) {
    enqueueNotesHydration({ topicId: note.topicId, language: String(note.language) })
      .then((result) => {
        logger.info('reject_note: auto-regeneration enqueued', { noteId: params.id, topicId: note.topicId, ...result });
      })
      .catch((err) => {
        logger.error('reject_note: auto-regeneration failed', { noteId: params.id, error: String(err) });
      });
  }

  return NextResponse.json({ rejected: true, regenerationQueued: !!note.topicId });
}
