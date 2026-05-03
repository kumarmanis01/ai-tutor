/**
 * FILE OBJECTIVE:
 * - Render the student onboarding diagnostic page by loading the authenticated student's profile data and passing the required quiz configuration to the client component.
 * - Redirect students away when no active session exists or when the onboarding diagnostic has already been completed.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(student)/student/onboarding/diagnostic/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-28T00:00:00Z | copilot | created standard file header template for new file compliance
 */

import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import DiagnosticPageClient from './DiagnosticPageClient';

export const dynamic = 'force-dynamic';

export default async function DiagnosticPage() {
  const session = await requireActiveSession();
  if (!session) redirect('/');

  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      grade: true,
      board: true,
      subjects: true,
      onboardingDiagnosticCompletedAt: true,
    },
  });

  if (!user) redirect('/');

  // If diagnostic already completed, skip to learning map.
  if (user.onboardingDiagnosticCompletedAt) {
    redirect('/dashboard');
  }

  const grade = user.grade ? parseInt(String(user.grade), 10) : 0;
  const board = user.board ?? '';

  // For grades 9-12 pass the first selected subject (if any).
  let selectedSubject: string | undefined;
  if (grade >= 9) {
    const rawSubjects = user.subjects;
    const subjects: string[] = Array.isArray(rawSubjects)
      ? (rawSubjects as string[])
      : typeof rawSubjects === 'string' && rawSubjects.length > 0
      ? rawSubjects
          .replace(/^\{/, '')
          .replace(/\}$/, '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    selectedSubject = subjects[0];
  }

  return (
    <DiagnosticPageClient
      grade={grade}
      board={board}
      studentId={userId}
      accessToken={`full:${userId}`}
      selectedSubject={selectedSubject}
    />
  );
}
