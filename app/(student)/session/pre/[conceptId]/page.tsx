/**
 * FILE OBJECTIVE:
 * - Server pre-session page for /session/pre/[conceptId]. Loads concept/topic context,
 *   prerequisite mastery, and resumable session metadata before rendering PreSessionScreen.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/session/pre/page.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | accept TopicDef.id fallback by resolving first active Concept
 *                          to prevent /session/pre redirects from bouncing back to dashboard
 */

import { redirect } from 'next/navigation';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
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

/** Estimate minutes based on IRT difficulty parameter. */
function estimateMinutes(irtB: number | null): number {
  if (irtB === null) return 12;
  if (irtB < -0.5) return 8;
  if (irtB <= 0.5) return 12;
  return 20;
}

export default async function PreSessionPage({ params }: Props) {
  const { conceptId } = await params;

  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    redirect(`/auth/signin?callbackUrl=/session/pre/${encodeURIComponent(conceptId)}`);
  }

  // Load concept + topic + chapter + subject + board chapter weight.
  // Primary path expects a Concept.id. Defensive fallback also accepts a TopicDef.id
  // and resolves to the first active concept for that topic.
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
  };

  const conceptById = await prisma.concept.findUnique({
    where: { id: conceptId },
    select: conceptSelect,
  });

  const concept = conceptById ?? await prisma.concept.findFirst({
    where: { topicId: conceptId, isSuspended: false },
    orderBy: { createdAt: 'asc' },
    select: conceptSelect,
  });

  if (!concept) redirect('/dashboard');

  const resolvedConceptId = concept.id;
  const topicId = concept.topicId;
  const subjectId = concept.subjectId;
  const subjectName = concept.topic.chapter.subject.name;
  const chapterName = concept.topic.chapter.name;
  const boardMarks =
    concept.topic.chapter.boardChapterWeights[0]?.weightMarks ?? null;
  const estimatedMinutes = estimateMinutes(concept.irt_b);

  // Load prerequisite concepts and their mastery scores for this student
  const prereqIds: string[] = concept.prerequisiteConceptIds ?? [];
  let prerequisites: PrereqInfo[] = [];
  if (prereqIds.length > 0) {
    type PrereqConceptRow = { id: string; name: string };
    type PrereqStateRow = { conceptId: string; masteryScore: number };

    const [prereqConcepts, prereqStates] = await Promise.all([
      prisma.concept.findMany({
        where: { id: { in: prereqIds } },
        select: { id: true, name: true },
      }),
      prisma.studentConceptState.findMany({
        where: { studentId: userId, conceptId: { in: prereqIds } },
        select: { conceptId: true, masteryScore: true },
      }),
    ]) as [PrereqConceptRow[], PrereqStateRow[]];

    const masteryMap = new Map(prereqStates.map((s: PrereqStateRow) => [s.conceptId, s.masteryScore]));
    prerequisites = prereqConcepts.map((c: PrereqConceptRow) => ({
      id: c.id,
      name: c.name,
      masteryScore: masteryMap.get(c.id) ?? 0,
    }));
    // Sort lowest mastery first so "Study prerequisites first" targets the weakest
    prerequisites.sort((a, b) => a.masteryScore - b.masteryScore);
  }

  // Check for an incomplete StructuredSession for this topic within 24h
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const incompleteSession = await prisma.structuredSession.findFirst({
    where: {
      studentId: userId,
      topicId,
      state: { notIn: ['COMPLETE', 'EXPIRED'] },
      startedAt: { gte: cutoff },
    },
    orderBy: { startedAt: 'desc' },
    select: { id: true, state: true, startedAt: true },
  });

  let interruptedSession: InterruptedSession | null = null;
  if (incompleteSession) {
    const minutesIn = Math.round(
      (Date.now() - incompleteSession.startedAt.getTime()) / 60_000,
    );
    interruptedSession = {
      sessionId: incompleteSession.id,
      phase: incompleteSession.state,
      phaseNumber: PHASE_NUMBERS[incompleteSession.state] ?? 1,
      minutesIn: Math.max(1, minutesIn),
    };
  }

  // Look up the LearningPlanItem for this concept (for "Skip to next topic")
  const planItem = await prisma.learningPlanItem.findFirst({
    where: {
      conceptId: resolvedConceptId,
      plan: { studentId: userId },
      status: { in: ['UPCOMING', 'IN_PROGRESS'] },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  // Background prefetch -- non-blocking, best-effort
  // In a server component we can't fire a true background fetch, so we skip it.
  // The session container will load its own content on first render.

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
