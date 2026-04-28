/**
 * S1.1 -- Board & Grade Confirmation page.
 *
 * Server component: reads current board, grade, and explore-diagnostic status from DB.
 * If the student completed their diagnostic in Explore Mode, skip straight to Learning Map.
 * Otherwise renders BoardGradeConfirmation (client component with carousel + grid).
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      grade: true,
      board: true,
      onboardingDiagnosticCompletedAt: true,
    },
  });

  if (!user) redirect('/');

  const grade = user.grade ? parseInt(String(user.grade), 10) : 0;
  const board = user.board ?? '';

  return (
    <BoardGradeConfirmation
      initialBoard={board}
      initialGrade={grade}
      studentId={userId}
      hasCompletedExploreDiagnostic={user.onboardingDiagnosticCompletedAt !== null}
    />
  );
}
