/**
 * FILE OBJECTIVE:
 * - Post-enrollment diagnostic queue page.
 * - Finds the next subject (from the student's enrolled subjects) that has no
 *   completed DiagnosticSession, then redirects to /diagnostic/[subjectId].
 * - When all subjects are diagnosed, redirects to /enroll/skill-map.
 * - Shows a loading screen with subject progress while resolving.
 *
 * EDIT LOG:
 * - 2026-05-05 | claude | created for post-enrollment diagnostic flow
 */

import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SoftDeleteStatus } from '@prisma/client';
import DiagnosticQueueClient from './DiagnosticQueueClient';

export const dynamic = 'force-dynamic';

export default async function DiagnosticQueuePage() {
  const session = await requireActiveSession();
  if (!session) redirect('/');

  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { board: true, grade: true, subjects: true, language: true },
  });

  if (!user?.board || !user?.grade) {
    redirect('/enroll');
  }

  if (!user.subjects || user.subjects.length === 0) {
    redirect('/dashboard');
  }

  const gradeNum = Number(user.grade);

  // Fetch all available subject defs for this board/grade matching enrolled slugs
  const subjectDefs = await prisma.subjectDef.findMany({
    where: {
      lifecycle: SoftDeleteStatus.active,
      slug: { in: user.subjects },
      class: {
        grade: gradeNum,
        board: { slug: { equals: user.board, mode: 'insensitive' } },
      },
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });

  if (subjectDefs.length === 0) {
    redirect('/dashboard');
  }

  // Find completed diagnostic sessions for this student
  const completed = await prisma.diagnosticSession.findMany({
    where: {
      studentId: userId,
      status: 'COMPLETED',
      subjectId: { in: subjectDefs.map((s: any) => s.id) },
    },
    select: { subjectId: true },
  });
  const completedIds = new Set(completed.map((c: any) => c.subjectId));

  // Find the first pending subject
  const nextSubject = subjectDefs.find((s: any) => !completedIds.has(s.id)) ?? null;

  if (!nextSubject) {
    // All subjects diagnosed -- go to skill map
    redirect('/enroll/skill-map');
  }

  // Show a brief "preparing" screen then redirect to the diagnostic
  return (
    <DiagnosticQueueClient
      nextSubjectId={nextSubject.id}
      nextSubjectName={nextSubject.name}
      totalSubjects={subjectDefs.length}
      completedCount={completedIds.size}
    />
  );
}
