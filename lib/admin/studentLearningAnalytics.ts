/**
 * Admin Student Learning Analytics -- read-only aggregations for admin console.
 * Data: User (role=user), StructuredSession, StudentTopicProgress, HomeworkAssignment.
 */

import { prisma } from '@/lib/prisma';

const ROLE_STUDENT = 'user';
const ACTIVE_DAYS = 7;

export interface StudentLearningSummary {
  totalStudents: number;
  activeStudentsLast7Days: number;
  sessionsCompletedLast7Days: number;
  homeworkPendingCount: number;
}

export interface StudentLearningRow {
  studentId: string;
  email: string | null;
  name: string | null;
  board: string | null;
  grade: string | null;
  sessionsCompleted7d: number;
  lastActiveAt: Date | null;
  homeworkPending: number;
  weakTopicCount: number;
}

export interface StudentDrilldown {
  studentId: string;
  email: string | null;
  name: string | null;
  board: string | null;
  grade: string | null;
  sessionsCompleted7d: number;
  lastActiveAt: Date | null;
  homeworkPending: number;
  weakTopicCount: number;
  recentSessions: { sessionId: string; topicName: string; completedAt: Date | null }[];
  weakTopics: { topicId: string; topicName: string; mastery: number; practiceCount: number }[];
}

export async function getStudentLearningSummary(): Promise<StudentLearningSummary> {
  const since = new Date();
  since.setDate(since.getDate() - ACTIVE_DAYS);

  const [totalStudents, activeStudents, sessionsCompleted, homeworkPending] = await Promise.all([
    prisma.user.count({ where: { role: ROLE_STUDENT } }),
    prisma.structuredSession.findMany({
      where: { completedAt: { gte: since } },
      select: { studentId: true },
      distinct: ['studentId'],
    }).then((rows) => rows.length),
    prisma.structuredSession.count({ where: { completedAt: { gte: since } } }),
    prisma.homeworkAssignment.count({
      where: { status: { in: ['PENDING', 'OVERDUE'] } },
    }),
  ]);

  return {
    totalStudents,
    activeStudentsLast7Days: activeStudents,
    sessionsCompletedLast7Days: sessionsCompleted,
    homeworkPendingCount: homeworkPending,
  };
}

export async function getStudentLearningList(opts: {
  limit?: number;
  offset?: number;
  board?: string;
  grade?: string;
}): Promise<StudentLearningRow[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const since = new Date();
  since.setDate(since.getDate() - ACTIVE_DAYS);

  const students = await prisma.user.findMany({
    where: {
      role: ROLE_STUDENT,
      ...(opts.board ? { board: opts.board } : {}),
      ...(opts.grade ? { grade: opts.grade } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      board: true,
      grade: true,
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
  });

  const studentIds = students.map((s) => s.id);

  const [sessionsByStudent, homeworkByStudent, weakCountByStudent] = await Promise.all([
    prisma.structuredSession.groupBy({
      by: ['studentId'],
      where: {
        studentId: { in: studentIds },
        completedAt: { gte: since },
      },
      _count: { id: true },
      _max: { completedAt: true },
    }),
    prisma.homeworkAssignment.groupBy({
      by: ['studentId'],
      where: {
        studentId: { in: studentIds },
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      _count: { id: true },
    }),
    prisma.studentTopicProgress.groupBy({
      by: ['studentId'],
      where: {
        studentId: { in: studentIds },
        mastery: { lt: 0.4 },
        practiceCount: { gt: 5 },
      },
      _count: { topicId: true },
    }),
  ]);

  type SessionInfo = { count: number; last: Date | null };
  const sessionMap = new Map<string, SessionInfo>(
    sessionsByStudent.map((s) => [s.studentId, { count: s._count.id, last: s._max.completedAt }])
  );
  const homeworkMap = new Map(homeworkByStudent.map((h) => [h.studentId, h._count.id]));
  const weakMap = new Map(weakCountByStudent.map((w) => [w.studentId, w._count.topicId]));

  return students.map((s) => {
    const sess = sessionMap.get(s.id);
    const hw = homeworkMap.get(s.id) ?? 0;
    const weak = weakMap.get(s.id) ?? 0;
    return {
      studentId: s.id,
      email: s.email ?? null,
      name: s.name ?? null,
      board: s.board ?? null,
      grade: s.grade ?? null,
      sessionsCompleted7d: sess?.count ?? 0,
      lastActiveAt: sess?.last ?? null,
      homeworkPending: hw,
      weakTopicCount: weak,
    };
  });
}

export async function getStudentDrilldown(studentId: string): Promise<StudentDrilldown | null> {
  const since = new Date();
  since.setDate(since.getDate() - ACTIVE_DAYS);

  const user = await prisma.user.findUnique({
    where: { id: studentId, role: ROLE_STUDENT },
    select: { id: true, email: true, name: true, board: true, grade: true },
  });
  if (!user) return null;

  const [sessionsCompleted, lastActive, homeworkPending, weakTopics, recentSessions] = await Promise.all([
    prisma.structuredSession.count({
      where: { studentId, completedAt: { gte: since } },
    }),
    prisma.structuredSession.findFirst({
      where: { studentId },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    }),
    prisma.homeworkAssignment.count({
      where: { studentId, status: { in: ['PENDING', 'OVERDUE'] } },
    }),
    prisma.studentTopicProgress.findMany({
      where: { studentId, mastery: { lt: 0.4 }, practiceCount: { gt: 5 } },
      select: { topicId: true, mastery: true, practiceCount: true, topic: { select: { name: true } } },
      orderBy: { mastery: 'asc' },
      take: 20,
    }),
    prisma.structuredSession.findMany({
      where: { studentId },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: { id: true, completedAt: true, topic: { select: { name: true } } },
    }),
  ]);

  return {
    studentId: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    board: user.board ?? null,
    grade: user.grade ?? null,
    sessionsCompleted7d: sessionsCompleted,
    lastActiveAt: lastActive?.completedAt ?? null,
    homeworkPending,
    weakTopicCount: weakTopics.length,
    recentSessions: recentSessions.map((s) => ({
      sessionId: s.id,
      topicName: s.topic?.name ?? '--',
      completedAt: s.completedAt,
    })),
    weakTopics: weakTopics.map((w) => ({
      topicId: w.topicId,
      topicName: w.topic?.name ?? w.topicId,
      mastery: w.mastery,
      practiceCount: w.practiceCount,
    })),
  };
}
