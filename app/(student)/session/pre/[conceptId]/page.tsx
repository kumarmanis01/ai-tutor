/**
 * FILE OBJECTIVE:
 * - Server pre-session page for /session/pre/[conceptId].
 * - Loads concept, topic, chapter, subject, prerequisite mastery, and any
 *   resumable session within 24h, then renders PreSessionScreen (client).
 *
 * ARCHITECTURE:
 * - Server component: all DB work happens before hydration.
 * - Accepts either a Concept.id (primary) or a TopicDef.id (fallback: resolves
 *   to the first active concept for that topic -- prevents redirect loops from
 *   /student/path which navigates by topicId).
 * - No fetch-to-self; queries Prisma directly per server-component convention.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/session/pre/page.spec.ts
 *
 * EDIT LOG:
 * - 2026-06-04 | claude | created: port from OLD_student/session/pre/[conceptId]/page.tsx;
 *                          replace getServerSessionForHandlers with requireActiveSession;
 *                          align auth redirect to /auth/get-started pattern.
 */

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireActiveSession } from '@/lib/auth';
import PreSessionScreen from '@/components/student/session/PreSessionScreen';
import type { PrereqInfo, InterruptedSession } from '@/components/student/session/PreSessionScreen';

interface Props {
  params: Promise<{ conceptId: string }>;
}

const PHASE_NUMBERS: Record<string, number> = {
  OVERVIEW: 1,
  EXPLANATION: 2,
  PRACTICE: 3,
  TEST: 4,
  HOMEWORK: 5,
};

/** Estimate session minutes from IRT difficulty parameter. */
function estimateMinutes(irtB: number | null): number {
  if (irtB === null) return 12;
  if (irtB < -0.5) return 8;
  if (irtB <= 0.5) return 12;
  return 20;
}

const conceptSelect = {
  id: true,
  name: true,
  irt_b: true,
  prerequisiteConceptIds: true,
  topicId: true,
  subjectId: true,
  topic: {
    select: {
      id: true,
      name: true,
      chapter: {
        select: {
          id: true,
          name: true,
          boardChapterWeights: { select: { weightMarks: true }, take: 1 },
          subject: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

export default async function PreSessionPage({ params }: Props) {
  const { conceptId } = await params;

  const auth = await requireActiveSession();
  if (!auth) {
    redirect(`/auth/get-started?callbackUrl=/session/pre/${encodeURIComponent(conceptId)}`);
  }
  const userId = auth.user.id;

  // Primary lookup by Concept.id; fallback to TopicDef.id -> first active concept.
  // This prevents redirect loops when /student/path links by topicId.
  const conceptById = await prisma.concept.findUnique({
    where: { id: conceptId },
    select: conceptSelect,
  });

  const concept = conceptById ?? await prisma.concept.findFirst({
    where: { topicId: conceptId, isSuspended: false },
    orderBy: { createdAt: 'asc' },
    select: conceptSelect,
  });

  if (!concept) redirect('/student/dashboard');

  const resolvedConceptId = concept.id;
  const topicId = concept.topicId;
  const subjectId = concept.subjectId;
  const subjectName = concept.topic.chapter.subject.name;
  const chapterName = concept.topic.chapter.name;
  const boardMarks = concept.topic.chapter.boardChapterWeights[0]?.weightMarks ?? null;
  const estimatedMinutes = estimateMinutes(concept.irt_b);

  // Prerequisite mastery -- load in parallel with resumable-session check.
  const prereqIds: string[] = (concept.prerequisiteConceptIds as string[]) ?? [];

  type PrereqConceptRow = { id: string; name: string };
  type PrereqStateRow = { conceptId: string; masteryScore: number };

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [prereqConcepts, prereqStates, incompleteSession, planItem] = await Promise.all([
    prereqIds.length > 0
      ? prisma.concept.findMany({
          where: { id: { in: prereqIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as PrereqConceptRow[]),

    prereqIds.length > 0
      ? prisma.studentConceptState.findMany({
          where: { studentId: userId, conceptId: { in: prereqIds } },
          select: { conceptId: true, masteryScore: true },
        })
      : Promise.resolve([] as PrereqStateRow[]),

    // Resumable session within 24h -- only non-terminal states
    prisma.structuredSession.findFirst({
      where: {
        studentId: userId,
        topicId,
        state: { notIn: ['COMPLETE', 'EXPIRED'] },
        startedAt: { gte: cutoff },
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true, state: true, startedAt: true },
    }),

    // LearningPlanItem for the "Skip to next topic" action
    prisma.learningPlanItem.findFirst({
      where: {
        conceptId: resolvedConceptId,
        plan: { studentId: userId },
        status: { in: ['UPCOMING', 'IN_PROGRESS'] },
      },
      select: { id: true },
      orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
    }),
  ]);

  // Build prerequisites list sorted by ascending mastery (weakest first)
  const masteryMap = new Map(
    (prereqStates as PrereqStateRow[]).map((s) => [s.conceptId, s.masteryScore]),
  );
  const prerequisites: PrereqInfo[] = (prereqConcepts as PrereqConceptRow[])
    .map((c) => ({
      id: c.id,
      name: c.name,
      masteryScore: masteryMap.get(c.id) ?? 0,
    }))
    .sort((a, b) => a.masteryScore - b.masteryScore);

  // Interrupted session metadata
  let interruptedSession: InterruptedSession | null = null;
  if (incompleteSession) {
    const minutesIn = Math.max(
      1,
      Math.round((Date.now() - incompleteSession.startedAt.getTime()) / 60_000),
    );
    interruptedSession = {
      sessionId: incompleteSession.id,
      phase: incompleteSession.state,
      phaseNumber: PHASE_NUMBERS[incompleteSession.state] ?? 1,
      minutesIn,
    };
  }

  return (
    <PreSessionScreen
      conceptId={resolvedConceptId}
      conceptName={concept.name}
      topicId={topicId}
      subjectId={subjectId}
      subjectName={subjectName}
      chapterName={chapterName}
      estimatedMinutes={estimatedMinutes}
      boardMarks={boardMarks}
      prerequisites={prerequisites}
      interruptedSession={interruptedSession}
      planItemId={planItem?.id ?? null}
    />
  );
}
