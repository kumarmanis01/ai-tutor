/**
 * FILE OBJECTIVE:
 * - Reject a generated test, cascade the rejection to its promoted question rows,
 *   and optionally queue regeneration for the same topic.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/tests/[id]/reject.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | cascade GeneratedTest rejection to promoted Question rows so rejected content stays hidden
 */

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getServerSessionForHandlers } from '@/lib/session';
import { ApprovalStatus } from '@/lib/ai-engine/types';
import { enqueueQuestionsHydration } from '@/lib/execution-pipeline/enqueueTopicHydration';
import { QuestionStatus } from '@prisma/client';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const test = await prisma.generatedTest.findUnique({ where: { id } });
  if (!test) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const generatedQuestionIds = await prisma.generatedQuestion.findMany({
    where: { testId: id },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.generatedTest.update({ where: { id }, data: { status: ApprovalStatus.Rejected } }),
    prisma.question.updateMany({
      where: { id: { in: generatedQuestionIds.map((row: any) => row.id) } },
      data: { status: QuestionStatus.REJECTED },
    }),
    prisma.auditLog.create({ data: { adminId, targetEntity: 'GeneratedTest', targetId: id, action: 'CONTENT_REJECT', previousValue: { status: test.status }, newValue: { status: 'rejected' }, reason: reason ?? null } })
  ]);

  // Auto-regenerate: enqueue a new questions hydration job for this topic
  if (test.topicId) {
    enqueueQuestionsHydration({ topicId: test.topicId, language: String(test.language), difficulty: String(test.difficulty) })
      .then((result) => {
        logger.info('reject_test: auto-regeneration enqueued', { testId: id, topicId: test.topicId, ...result });
      })
      .catch((err) => {
        logger.error('reject_test: auto-regeneration failed', { testId: id, error: String(err) });
      });
  }

  return NextResponse.json({ rejected: true, regenerationQueued: !!test.topicId });
}
