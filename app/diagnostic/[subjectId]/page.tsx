/**
 * FILE OBJECTIVE:
 * - Full-screen diagnostic test page for a given SubjectDef.
 * - Checks for completed/cooldown status first; redirects away if needed.
 * - When content is not yet generated shows DiagnosticWaitingScreen.
 * - Otherwise renders DiagnosticFlow (client component).
 *
 * EDIT LOG:
 * - 2026-05-06 | claude | created for diagnostics status flow
 */

import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSubjectDiagnosticStatus } from '@/lib/diagnostics/stateStore';
import { SoftDeleteStatus } from '@prisma/client';
import DiagnosticFlow from '@/components/student/diagnostic/DiagnosticFlow';
import DiagnosticWaitingScreen from '@/components/student/diagnostic/DiagnosticWaitingScreen';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ subjectId: string }>;
}

export default async function DiagnosticPage({ params }: PageProps) {
  const authSession = await requireActiveSession();
  if (!authSession) redirect('/');

  const userId = (authSession.user as { id: string }).id;
  const { subjectId } = await params;

  const [student, subjectDef] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { board: true, grade: true, language: true },
    }),
    prisma.subjectDef.findUnique({
      where: { id: subjectId, lifecycle: SoftDeleteStatus.active },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  if (!student?.board || !student?.grade) redirect('/student/onboarding');
  if (!subjectDef) redirect('/student/diagnostics');

  const status = await getSubjectDiagnosticStatus(userId, subjectId);
  if (status.status === 'completed') redirect('/student/diagnostics');

  // Check whether content is ready (topics + questions exist)
  const topicCount = await prisma.topicDef.count({
    where: {
      chapter: { subjectId, lifecycle: SoftDeleteStatus.active },
      lifecycle: SoftDeleteStatus.active,
    },
  });

  if (topicCount === 0) {
    return (
      <DiagnosticWaitingScreen
        subjectId={subjectId}
        subjectName={subjectDef.name}
        reason="topics"
      />
    );
  }

  const qCount = await prisma.question.count({
    where: {
      status: 'ACTIVE',
      topic: {
        lifecycle: SoftDeleteStatus.active,
        chapter: { lifecycle: SoftDeleteStatus.active, subjectId },
      },
    },
  });

  if (qCount === 0) {
    return (
      <DiagnosticWaitingScreen
        subjectId={subjectId}
        subjectName={subjectDef.name}
        reason="questions"
      />
    );
  }

  return (
    <DiagnosticFlow
      subjectId={subjectId}
      subjectName={subjectDef.name}
      boardSlug={student.board}
      grade={student.grade}
      subjectSlug={subjectDef.slug}
      languageCode={student.language ?? undefined}
    />
  );
}
