/**
 * Admin Weak Topic Monitoring -- read-only aggregation for admin console.
 * Uses same weak-topic definition as lib/learning/getWeakTopics (mastery < 0.4, practiceCount > 5).
 */

import { prisma } from '@/lib/prisma';

const MASTERY_THRESHOLD = 0.4;
const PRACTICE_MIN = 5;
const SEVERITY_HIGH_COUNT = 20;

export interface WeakTopicByTopicRow {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  chapterId: string;
  chapterName: string;
  studentCount: number;
  severity: 'high' | 'medium' | 'low';
}

export interface WeakTopicByStudentRow {
  studentId: string;
  studentEmail: string | null;
  studentName: string | null;
  board: string | null;
  grade: string | null;
  weakTopicCount: number;
  topicIds: string[];
  topicNames: string[];
  severity: 'high' | 'medium' | 'low';
}

export interface WeakTopicSummary {
  totalStudentsWithWeakTopics: number;
  totalWeakTopicInstances: number;
}

export async function getWeakTopicsByTopic(opts: {
  board?: string;
  grade?: string;
  subjectId?: string;
  limit?: number;
}): Promise<WeakTopicByTopicRow[]> {
  const limit = Math.min(opts.limit ?? 100, 500);

  const topicWhere: Record<string, unknown> = {
    lifecycle: 'active',
    chapter: {
      ...(opts.subjectId ? { subjectId: opts.subjectId } : {}),
      ...(opts.grade || opts.board
        ? {
            subject: {
              class: {
                ...(opts.grade ? { grade: parseInt(opts.grade, 10) } : {}),
                ...(opts.board ? { board: { slug: opts.board } } : {}),
              },
            },
          }
        : {}),
    },
  };

  const weakRows = await prisma.studentTopicProgress.findMany({
    where: {
      mastery: { lt: MASTERY_THRESHOLD },
      practiceCount: { gt: PRACTICE_MIN },
      // Cast to any to avoid tight coupling to generated Prisma types; the
      // object shape mirrors TopicDef where structure and is covered by tests.
      topic: topicWhere as any,
    },
    select: {
      topicId: true,
      topic: {
        select: {
          name: true,
          chapterId: true,
          chapter: {
            select: {
              name: true,
              subjectId: true,
              subject: { select: { name: true, id: true } },
            },
          },
        },
      },
    },
  });

  const byTopic = new Map<
    string,
    { topicName: string; chapterId: string; chapterName: string; subjectId: string; subjectName: string; count: number }
  >();
  for (const r of weakRows) {
    const t = (r as typeof r & { topic: { name: string; chapterId: string; chapter: { name: string; subject: { id: string; name: string } } } }).topic;
    if (!t?.chapter?.subject) continue;
    const key = r.topicId;
    const existing = byTopic.get(key);
    if (existing) existing.count++;
    else
      byTopic.set(key, {
        topicName: t.name,
        chapterId: t.chapterId,
        chapterName: t.chapter.name,
        subjectId: t.chapter.subject.id,
        subjectName: t.chapter.subject.name,
        count: 1,
      });
  }

  const list = Array.from(byTopic.entries())
    .map(([topicId, v]) => ({
      topicId,
      topicName: v.topicName,
      subjectId: v.subjectId,
      subjectName: v.subjectName,
      chapterId: v.chapterId,
      chapterName: v.chapterName,
      studentCount: v.count,
      severity: (v.count >= SEVERITY_HIGH_COUNT ? 'high' : v.count >= 5 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    }))
    .sort((a, b) => b.studentCount - a.studentCount)
    .slice(0, limit);

  return list;
}

export async function getWeakTopicsByStudent(opts: {
  board?: string;
  grade?: string;
  subjectId?: string;
  limit?: number;
}): Promise<WeakTopicByStudentRow[]> {
  const limit = Math.min(opts.limit ?? 100, 500);

  const weakRows = await prisma.studentTopicProgress.findMany({
    where: {
      mastery: { lt: MASTERY_THRESHOLD },
      practiceCount: { gt: PRACTICE_MIN },
      topic: {
        lifecycle: 'active',
        ...(opts.subjectId ? { chapter: { subjectId: opts.subjectId } } : {}),
      },
    },
    select: {
      studentId: true,
      topicId: true,
      student: { select: { email: true, name: true, board: true, grade: true } },
      topic: { select: { name: true } },
    },
  });

  const byStudent = new Map<
    string,
    { email: string | null; name: string | null; board: string | null; grade: string | null; topicIds: string[]; topicNames: string[] }
  >();
  for (const r of weakRows) {
    const existing = byStudent.get(r.studentId);
    const email = r.student?.email ?? null;
    const name = r.student?.name ?? null;
    const board = r.student?.board ?? null;
    const grade = r.student?.grade ?? null;
    if (existing) {
      existing.topicIds.push(r.topicId);
      existing.topicNames.push(r.topic?.name ?? r.topicId);
    } else byStudent.set(r.studentId, { email, name, board, grade, topicIds: [r.topicId], topicNames: [r.topic?.name ?? r.topicId] });
  }

  let list = Array.from(byStudent.entries())
    .map(([studentId, v]) => ({
      studentId,
      studentEmail: v.email,
      studentName: v.name,
      board: v.board,
      grade: v.grade,
      weakTopicCount: v.topicIds.length,
      topicIds: v.topicIds,
      topicNames: v.topicNames,
      severity: (v.topicIds.length >= 5 ? 'high' : v.topicIds.length >= 2 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    }))
    .sort((a, b) => b.weakTopicCount - a.weakTopicCount)
    .slice(0, limit);

  if (opts.board || opts.grade) {
    list = list.filter((s) => {
      if (opts.board && s.board !== opts.board) return false;
      if (opts.grade && s.grade !== opts.grade) return false;
      return true;
    });
  }

  return list;
}

export async function getWeakTopicsSummary(): Promise<WeakTopicSummary> {
  const [studentsWithWeak, instances] = await Promise.all([
    prisma.studentTopicProgress.groupBy({
      by: ['studentId'],
      where: {
        mastery: { lt: MASTERY_THRESHOLD },
        practiceCount: { gt: PRACTICE_MIN },
      },
      _count: { topicId: true },
    }),
    prisma.studentTopicProgress.count({
      where: {
        mastery: { lt: MASTERY_THRESHOLD },
        practiceCount: { gt: PRACTICE_MIN },
      },
    }),
  ]);

  return {
    totalStudentsWithWeakTopics: studentsWithWeak.length,
    totalWeakTopicInstances: instances,
  };
}
