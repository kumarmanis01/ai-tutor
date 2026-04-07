/**
 * Learning Path Page
 *
 * Shows the student's full curriculum as a subject → chapter → topic grid.
 * Each topic shows its current mastery status using qualitative labels.
 *
 * This is a read-only reference view. It is NOT the primary navigation.
 * Students reach it via the "View full learning path" link on the dashboard.
 *
 * Design rules (UX architecture review):
 *   - List format, not cards -- low visual weight
 *   - Qualitative labels only (Mastered / Understood / Getting there / Needs practice)
 *   - No percentages shown
 *   - In-progress topics show "Continue →" link
 *   - Upcoming topics show "Start →" link
 *
 * Data source: GET /api/home/learning-snapshot (already exists, no new endpoint)
 * Mastery enrichment: cross-referenced with StudentTopicProgress and
 * StructuredSession (for in-progress detection)
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | created per UX architecture blueprint (Phase 3)
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import SubjectSection from '@/components/learning-path/SubjectSection';

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

  // ── Fetch snapshot + mastery + active sessions in parallel ────────────────
  const [snapshotRes, masteryRows, activeSessions] = await Promise.all([
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
  ]);

  const masteryMap = new Map(masteryRows.map((r) => [r.topicId, r.mastery]));
  const inProgressMap = new Map(activeSessions.map((s) => [s.topicId, s.id]));

  const subjects: SubjectSnapshot[] = snapshotRes?.subjects ?? [];

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
