/**
 * FILE OBJECTIVE:
 * - Returns a subject-level + chapter-level learning path snapshot for the
 *   authenticated student, computed from real curriculum data (TopicDef /
 *   ChapterDef / SubjectDef) joined with StudentTopicMastery.
 * - No AI. No stale cache. Pure Prisma aggregation.
 *
 * Response shape:
 *   { subjects: SubjectSnapshotData[] }
 *
 * SubjectSnapshotData {
 *   subjectId, name, topicCount, completedTopics, percentComplete, mastery,
 *   chapters: ChapterSnapshotData[]
 * }
 * ChapterSnapshotData { chapterId, name, order, topicCount, completedTopics, progress }
 *
 * EDIT LOG:
 * - 2026-02-22 | claude | created — replaces empty data with real curriculum query
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { LOW_ACCURACY_THRESHOLD, MASTERY_LEVELS } from '@/lib/constants/mastery';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSessionForHandlers();
  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ subjects: [] }, { status: 401 });
  }

  // ── Fetch student curriculum context ─────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { board: true, grade: true, subjects: true },
  });

  if (!user?.board || !user?.grade) {
    return NextResponse.json({ subjects: [] });
  }

  const grade = parseInt(String(user.grade), 10);
  if (isNaN(grade)) return NextResponse.json({ subjects: [] });

  // ── Narrow to enrolled subjects (if specified) ────────────────────────────
  const enrolledSubjects =
    Array.isArray(user.subjects) && (user.subjects as string[]).length > 0
      ? (user.subjects as string[])
      : null;

  // ── Query curriculum hierarchy in a single round-trip ────────────────────
  const subjects = await prisma.subjectDef.findMany({
    where: {
      lifecycle: 'active',
      ...(enrolledSubjects ? { name: { in: enrolledSubjects } } : {}),
      class: {
        lifecycle: 'active',
        grade,
        board: {
          lifecycle: 'active',
          slug: { equals: user.board, mode: 'insensitive' },
        },
      },
    },
    select: {
      id: true,
      name: true,
      chapters: {
        where: { lifecycle: 'active' },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          name: true,
          order: true,
          topics: {
            where: { lifecycle: 'active' },
            orderBy: { order: 'asc' },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  if (subjects.length === 0) {
    return NextResponse.json({ subjects: [] });
  }

  // ── Fetch mastery records for this student ────────────────────────────────
  const masteryRecords = await prisma.studentTopicMastery.findMany({
    where: { studentId: userId },
    select: { topicId: true, masteryLevel: true, accuracy: true },
  });

  // Build a set of attempted topic IDs and a quick lookup map
  const masteryByTopicId = new Map(masteryRecords.map((m) => [m.topicId, m]));

  // ── Aggregate per-subject + per-chapter ──────────────────────────────────
  const result = subjects.map((sub) => {
    let subjectTotalTopics = 0;
    let subjectAttemptedTopics = 0;
    let subjectSumAccuracy = 0;
    let subjectMasteredCount = 0;

    const chapterSnapshots = sub.chapters.map((ch) => {
      const topicCount = ch.topics.length;
      let completedTopics = 0;
      let _sumAccuracy = 0;

      for (const topic of ch.topics) {
        const m = masteryByTopicId.get(topic.id);
        if (m) {
          subjectAttemptedTopics++;
          _sumAccuracy += m.accuracy;
          subjectSumAccuracy += m.accuracy;
          // Use accuracy >= LOW_ACCURACY_THRESHOLD — aligned with engine P4 threshold.
          if (m.accuracy >= LOW_ACCURACY_THRESHOLD) {
            completedTopics++;
            subjectMasteredCount++;
          }
        }
      }

      subjectTotalTopics += topicCount;

      return {
        chapterId: ch.id,
        name: ch.name,
        order: ch.order,
        topicCount,
        completedTopics,
        progress: topicCount > 0 ? Math.round((completedTopics / topicCount) * 100) : 0,
      };
    });

    const percentComplete =
      subjectTotalTopics > 0
        ? Math.round((subjectMasteredCount / subjectTotalTopics) * 100)
        : 0;

    // Mastery label: based on average accuracy across attempted topics
    let mastery: 'weak' | 'improving' | 'strong' = 'weak';
    if (subjectAttemptedTopics > 0) {
      const avg = subjectSumAccuracy / subjectAttemptedTopics;
      if (avg >= MASTERY_LEVELS.advanced.minAccuracy) mastery = 'strong';
      else if (avg >= 0.5) mastery = 'improving';
    }

    return {
      subjectId: sub.id,
      name: sub.name,
      topicCount: subjectTotalTopics,
      completedTopics: subjectMasteredCount,
      percentComplete,
      mastery,
      chapters: chapterSnapshots,
    };
  });

  return NextResponse.json({ subjects: result });
}
