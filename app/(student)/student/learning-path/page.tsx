/**
 * FILE OBJECTIVE:
 * - Server-render the student's personalised week-by-week learning timeline.
 * - F-STU-003: student sees their plan immediately after onboarding.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/learning-path/page.test.tsx
 *
 * EDIT LOG:
 * - 2026-05-23T00:00:00Z | claude | created for F-STU-003 learning path feature
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildTimeline } from '@/lib/student/learningPlanTimeline';
import LearningPathClient from '@/components/student/learning-path/LearningPathClient';
import LearningPathSkeleton from '@/components/student/learning-path/LearningPathSkeleton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Learning Path | Spinzy AI Tutor',
  description: 'Your personalised week-by-week learning timeline.',
};

interface Props {
  searchParams?: Promise<{ onboarding?: string }>;
}

export default async function StudentLearningPathPage({ searchParams }: Props) {
  const authSession = await requireActiveSession();
  if (!authSession) redirect('/');

  const userId = (authSession.user as { id: string }).id;
  const params = searchParams ? await searchParams : {};
  const isFirstVisit = params.onboarding === 'true';

  const rawPlan = await prisma.learningPlan.findFirst({
    where: { studentId: userId },
    orderBy: { generatedAt: 'desc' },
    select: {
      id: true,
      subjectId: true,
      examDate: true,
      weeklyGoal: true,
      generatedAt: true,
      items: {
        orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
        select: {
          id: true,
          conceptId: true,
          weekNumber: true,
          orderInWeek: true,
          status: true,
          concept: {
            select: {
              name: true,
              topic: {
                select: {
                  chapter: {
                    select: {
                      id: true,
                      name: true,
                      boardChapterWeights: { select: { weightMarks: true }, take: 1 },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!rawPlan) {
    // F-STU-003: no plan yet -- send student to generate one
    redirect('/student/onboarding/exam-date');
  }

  const subjectRecord = await prisma.subjectDef.findUnique({
    where: { id: rawPlan.subjectId },
    select: { name: true },
  });

  const timelineData = buildTimeline(rawPlan, undefined, subjectRecord?.name ?? '');

  return (
    <Suspense fallback={<LearningPathSkeleton />}>
      <LearningPathClient data={timelineData} isFirstVisit={isFirstVisit} />
    </Suspense>
  );
}
