/**
 * Mock Exam selection page -- /mock
 *
 * Lists available full mock exams for the student's grade/board/subjects.
 * "Generate new mock" CTA calls /api/mock/generate.
 *
 * Server component: fetches the list server-side, passes to client widget.
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | created for F-STU-021
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import MockExamListClient from './_components/MockExamListClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Full Mock Exams | Spinzy AI Tutor',
  description: 'Board-pattern full mock exams for your grade and board.',
};

export default async function MockExamPage() {
  const session = await requireActiveSession();
  if (!session) redirect('/');

  const userId = (session.user as { id: string }).id;

  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: { grade: true, board: true, subjects: true },
  });

  const grade = profile?.grade ? Number(profile.grade) : null;
  const board = profile?.board ?? null;
  const subjects = (profile?.subjects ?? []).map((s) => String(s)).filter(Boolean);

  if (!grade || !board) {
    redirect('/onboarding');
  }

  const mocks =
    grade && board
      ? await prisma.mockExam.findMany({
          where: { grade, board: { equals: board, mode: 'insensitive' }, status: 'active' },
          select: {
            id: true,
            title: true,
            totalMarks: true,
            durationMin: true,
            version: true,
            subject: { select: { name: true } },
            _count: { select: { attempts: { where: { studentId: userId } } } },
          },
          orderBy: [{ subject: { name: 'asc' } }, { version: 'asc' }],
          take: 50,
        })
      : [];

  const mockList = mocks.map((m) => ({
    id: m.id,
    title: m.title,
    subjectName: m.subject.name,
    totalMarks: m.totalMarks,
    durationMin: m.durationMin,
    version: m.version,
    attemptCount: m._count.attempts,
  }));

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">Full Mock Exams</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Board-pattern papers for Grade {grade} · {board}. Each exam spans the full syllabus.
      </p>
      <MockExamListClient
        mocks={mockList}
        subjects={subjects}
        grade={String(grade)}
        board={board}
      />
    </main>
  );
}
