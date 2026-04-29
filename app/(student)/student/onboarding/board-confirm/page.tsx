/**
 * FILE OBJECTIVE:
 * - S1.1 Board & Grade Confirmation page (server component).
 *   Reads current board, grade, and explore-diagnostic status from DB.
 *   If the student completed their diagnostic in Explore Mode, the client
 *   component skips straight to the Learning Map.
 *   Otherwise renders BoardGradeConfirmation (carousel + grid).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/onboarding/board-confirm/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-28T00:00:00Z | staff-engineer | created for S1.1 board & grade confirmation
 */

import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import BoardGradeConfirmation from '@/components/student/onboarding/BoardGradeConfirmation';

export const dynamic = 'force-dynamic';

export default async function BoardConfirmPage() {
  const session = await requireActiveSession();
  if (!session) redirect('/');

  const userId = (session.user as { id: string }).id;

  const [user, learningProfile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        grade: true,
        board: true,
        onboardingDiagnosticCompletedAt: true,
      },
    }),
    prisma.studentLearningProfile.findUnique({
      where: { studentId: userId },
      select: { studyDaysPerWeek: true },
    }),
  ]);

  if (!user) redirect('/');

  // If the user has already generated a plan (completed exam-date step) or
  // completed the diagnostic, skip board-confirm entirely.
  if (learningProfile?.studyDaysPerWeek != null || user.onboardingDiagnosticCompletedAt !== null) {
    redirect('/student/learning-map');
  }

  const grade = user.grade ? parseInt(String(user.grade), 10) : 0;
  const board = user.board ?? '';

  return (
    <BoardGradeConfirmation
      initialBoard={board}
      initialGrade={grade}
      studentId={userId}
      hasCompletedExploreDiagnostic={false}
    />
  );
}
