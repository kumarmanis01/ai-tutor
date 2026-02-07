import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getServerSessionForHandlers } from '@/lib/session';
import { ApprovalStatus } from '@/lib/ai-engine/types';
import { enqueueQuestionsHydration } from '@/lib/execution-pipeline/enqueueTopicHydration';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { reason } = await req.json();
  if (reason) logger.add(`Test rejected for reason: ${reason}`);

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

  const test = await prisma.generatedTest.findUnique({ where: { id: params.id } });
  if (!test) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.generatedTest.update({ where: { id: params.id }, data: { status: ApprovalStatus.Rejected } }),
    prisma.auditLog.create({ data: { userId: adminId, action: 'reject_test', details: { testId: params.id, reason, fromStatus: test.status }, createdAt: new Date() } })
  ]);

  // Auto-regenerate: enqueue a new questions hydration job for this topic
  if (test.topicId) {
    enqueueQuestionsHydration({ topicId: test.topicId, language: String(test.language), difficulty: String(test.difficulty) })
      .then((result) => {
        logger.info('reject_test: auto-regeneration enqueued', { testId: params.id, topicId: test.topicId, ...result });
      })
      .catch((err) => {
        logger.error('reject_test: auto-regeneration failed', { testId: params.id, error: String(err) });
      });
  }

  return NextResponse.json({ rejected: true, regenerationQueued: !!test.topicId });
}
