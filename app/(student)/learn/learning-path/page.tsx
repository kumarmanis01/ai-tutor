/**
 * Learning Path Page
 *
 * Shows the student's full curriculum as a subject → chapter → topic grid.
 * Each topic shows its current mastery status using qualitative labels.
 * AC-04 (F-STU-003): also renders the visual study plan timeline with week-by-week
 * chapter sequence and session counts above the curriculum map.
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | created per UX architecture blueprint (Phase 3)
 *   2026-04-16T00:00:00Z | copilot | AC-04 (F-STU-003): add plan timeline section
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import SubjectSection from '@/components/learning-path/SubjectSection';
import { LearningPlanTimeline } from '@/components/student/LearningPlanTimeline';
import type { TimelineResponse } from '@/app/api/student/learning-plan/timeline/route';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Learning Path | Spinzy AI Tutor',
  description: 'Your full curriculum map with topic mastery at a glance.',
};

// ── Types matching /api/home/learning-snapshot response ──────────────────────

interface ChapterSnapshot {
  chapterId: string;
  name: string;
  order: number;
  topicCount: number;
  completedTopics: number;
  progress: number;
  topics?: { topicId: string; name: string; mastery?: number }[];
}

interface SubjectSnapshot {
  subjectId: string;
  name: string;
  topicCount: number;
  completedTopics: number;
  percentComplete: number;
  mastery: number;
  chapters: ChapterSnapshot[];
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function LearningPathPage() {
  const authSession = await requireActiveSession();
  if (!authSession) redirect('/');

  const userId = (authSession.user as { id: string }).id;

  // ── Fetch snapshot + mastery + active sessions + plan timeline in parallel ─
  const [snapshotRes, masteryRows, activeSessions, rawPlanData] = await Promise.all([
    fetch(`${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/home/learning-snapshot`, {
      cache: 'no-store',
      headers: { Cookie: '' }, // will use server-side auth via getServerSessionForHandlers
    }).then((r) => r.json() as Promise<{ subjects?: SubjectSnapshot[] }>).catch(() => ({ subjects: [] })),

    // Topic-level mastery for qualitative labels
    prisma.studentTopicProgress.findMany({
      where: { studentId: userId },
      select: { topicId: true, mastery: true },
    }),

    // In-progress sessions for "Continue →" links
    prisma.structuredSession.findMany({
      where: { studentId: userId, state: { notIn: ['COMPLETE', 'EXPIRED'] } },
      select: { id: true, topicId: true },
    }),

    // AC-04: plan timeline data (first plan only; no second round-trip needed)
    prisma.learningPlan.findFirst({
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
                topic: { select: { chapter: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
    }).catch(() => null),
  ]);

  const masteryMap = new Map(masteryRows.map((r) => [r.topicId, r.mastery]));
  const inProgressMap = new Map(activeSessions.map((s) => [s.topicId, s.id]));

  const subjects: SubjectSnapshot[] = snapshotRes?.subjects ?? [];

  // AC-04: build timeline payload from Prisma plan data
  let timelineData: TimelineResponse | null = null;
  if (rawPlanData) {
    const weekMap = new Map<number, TimelineResponse['weeks'][number]['items']>();
    for (const item of rawPlanData.items) {
      const week = weekMap.get(item.weekNumber) ?? [];
      week.push({
        id: item.id,
        conceptId: item.conceptId,
        conceptName: item.concept.name,
        chapterName: item.concept.topic.chapter.name,
        chapterId: item.concept.topic.chapter.id,
        orderInWeek: item.orderInWeek,
        status: item.status as TimelineResponse['weeks'][number]['items'][number]['status'],
        isMandatory: false,
      });
      weekMap.set(item.weekNumber, week);
    }
    const totalWeeks = weekMap.size > 0 ? Math.max(...weekMap.keys()) : 0;
    const base = rawPlanData.generatedAt;
    const weeks: TimelineResponse['weeks'] = Array.from(weekMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNumber, items]) => {
        const chMap = new Map<string, number>();
        for (const i of items) chMap.set(i.chapterName, (chMap.get(i.chapterName) ?? 0) + 1);
        // Compute week start date (Monday)
        const d = new Date(base);
        const dow = d.getDay() === 0 ? 7 : d.getDay();
        d.setDate(d.getDate() - dow + 1 + (weekNumber - 1) * 7);
        d.setHours(0, 0, 0, 0);
        return {
          weekNumber,
          startDate: d.toISOString().split('T')[0],
          items,
          chapterSummary: Array.from(chMap.entries()).map(([chapterName, sessionCount]) => ({
            chapterName,
            sessionCount,
          })),
        };
      });

    const subjectRecord = await prisma.subjectDef.findUnique({
      where: { id: rawPlanData.subjectId },
      select: { name: true },
    });

    timelineData = {
      planId: rawPlanData.id,
      subjectId: rawPlanData.subjectId,
      subjectName: subjectRecord?.name ?? '',
      examDate: rawPlanData.examDate ? rawPlanData.examDate.toISOString() : null,
      weeklyGoal: rawPlanData.weeklyGoal,
      totalWeeks,
      totalConcepts: rawPlanData.items.length,
      completedConcepts: rawPlanData.items.filter((i) => i.status === 'COMPLETED').length,
      weeks,
    };
  }

  // Fallback: when the learning plan hasn't been generated yet (bootstrap job
  // still running), load the full curriculum from the DB so the student sees
  // something useful rather than an empty screen.
  type CurriculumSubject = {
    subjectId: string;
    subjectName: string;
    chapters: { chapterId: string; chapterName: string; topics: { topicId: string; topicName: string }[] }[];
  };
  let curriculumFallback: CurriculumSubject[] = [];
  if (subjects.length === 0) {
    const studentProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: { board: true, grade: true, subjects: true },
    });
    const enrolledSlugs: string[] = Array.isArray(studentProfile?.subjects)
      ? (studentProfile!.subjects as string[]).filter(Boolean)
      : typeof studentProfile?.subjects === 'string'
      ? (studentProfile!.subjects as string).replace(/^\{/, '').replace(/\}$/, '').split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    if (studentProfile?.board && studentProfile?.grade && enrolledSlugs.length > 0) {
      const subjectDefs = await prisma.subjectDef.findMany({
        where: {
          lifecycle: 'active',
          slug: { in: enrolledSlugs },
          class: {
            grade: parseInt(String(studentProfile.grade), 10),
            board: { slug: studentProfile.board },
          },
        },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          chapters: {
            where: { lifecycle: 'active' },
            orderBy: { order: 'asc' },
            select: {
              id: true,
              name: true,
              topics: {
                where: { lifecycle: 'active' },
                orderBy: { order: 'asc' },
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      curriculumFallback = subjectDefs.map((s) => ({
        subjectId: s.id,
        subjectName: s.name,
        chapters: s.chapters.map((ch) => ({
          chapterId: ch.id,
          chapterName: ch.name,
          topics: ch.topics.map((t) => ({ topicId: t.id, topicName: t.name })),
        })),
      }));
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/dashboard"
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-1"
          >
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Learning Path</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Your full curriculum -- topic by topic.
          </p>
        </div>
      </div>

      {/* AC-04: Study Plan Timeline section */}
      {timelineData && (
        <section className="mb-8">
          <LearningPlanTimeline initialData={timelineData} />
        </section>
      )}

      {/* Divider */}
      {timelineData && (
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Full curriculum map</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {subjects.length === 0 && curriculumFallback.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Your learning path is being prepared.</p>
          <p className="text-xs mt-1">Check back in a moment once your plan is ready.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(subjects.length > 0 ? subjects : null)?.map((subject) => {
            const chapters = subject.chapters.map((ch) => {
              const topics = (ch.topics ?? []).map((t) => ({
                topicId: t.topicId,
                topicName: t.name,
                mastery: masteryMap.get(t.topicId) ?? t.mastery ?? null,
                isInProgress: inProgressMap.has(t.topicId),
                sessionId: inProgressMap.get(t.topicId),
              }));
              return { chapterId: ch.chapterId, chapterName: ch.name, topics };
            });

            return (
              <SubjectSection
                key={subject.subjectId}
                subjectId={subject.subjectId}
                subjectName={subject.name}
                chapters={chapters}
                completedTopics={subject.completedTopics}
                totalTopics={subject.topicCount}
              />
            );
          })}

          {/* Curriculum fallback: show full topic list when learning plan not yet generated */}
          {subjects.length === 0 && curriculumFallback.map((subject) => {
            const totalTopics = subject.chapters.reduce((n, ch) => n + ch.topics.length, 0);
            const chapters = subject.chapters.map((ch) => ({
              chapterId: ch.chapterId,
              chapterName: ch.chapterName,
              topics: ch.topics.map((t) => ({
                topicId: t.topicId,
                topicName: t.topicName,
                mastery: masteryMap.get(t.topicId) ?? null,
                isInProgress: inProgressMap.has(t.topicId),
                sessionId: inProgressMap.get(t.topicId),
              })),
            }));

            return (
              <SubjectSection
                key={subject.subjectId}
                subjectId={subject.subjectId}
                subjectName={subject.name}
                chapters={chapters}
                completedTopics={0}
                totalTopics={totalTopics}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
