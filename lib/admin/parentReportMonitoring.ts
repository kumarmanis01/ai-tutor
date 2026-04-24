/**
 * Admin Parent Report Monitoring -- scope, student list, and pause toggle via AdminConfig.
 */

import { prisma } from '@/lib/prisma';

// Local row types for strict mode
type ParentStudentLinkRow = { studentId: string };
type UserRow = { id: string; email: string | null; name: string | null; board: string | null; grade: string | null };
type WeeklyStudentSummaryRow = { studentId: string; weekStart: Date };

const CONFIG_KEY_REPORTS_PAUSED = 'parent_reports_paused';

export interface ParentReportScope {
  studentsWithLinkedParents: number;
  reportsGeneratedThisWeek: number;
  lastRunAt: Date | null;
}

export interface ParentReportStudentRow {
  studentId: string;
  studentEmail: string | null;
  studentName: string | null;
  board: string | null;
  grade: string | null;
  lastReportWeekStart: Date | null;
  hasReport: boolean;
}

export async function getParentReportScope(): Promise<ParentReportScope> {
  const [linksRaw, weekStart] = await Promise.all([
    prisma.parentStudent.findMany({
      where: { status: 'active' },
      select: { studentId: true },
      distinct: ['studentId'],
    }),
    getCurrentWeekStart(),
  ]);

  const links = linksRaw as ParentStudentLinkRow[];
  const studentIds = links.map((l) => l.studentId);
  const reportsThisWeek =
    studentIds.length > 0
      ? await prisma.weeklyStudentSummary.count({
          where: {
            studentId: { in: studentIds },
            weekStart: { gte: weekStart },
          },
        })
      : 0;

  return {
    studentsWithLinkedParents: studentIds.length,
    reportsGeneratedThisWeek: reportsThisWeek,
    lastRunAt: null,
  };
}

async function getCurrentWeekStart(): Promise<Date> {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

export async function getParentReportStudents(opts: {
  board?: string;
  grade?: string;
  limit?: number;
  offset?: number;
}): Promise<{ students: ParentReportStudentRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  const links = await prisma.parentStudent.findMany({
    where: { status: 'active' },
    select: { studentId: true },
    distinct: ['studentId'],
  }) as ParentStudentLinkRow[];
  const studentIds = (links as ParentStudentLinkRow[]).map((l: ParentStudentLinkRow) => l.studentId);

  if (studentIds.length === 0) {
    return { students: [], total: 0 };
  }

  const where = {
    id: { in: studentIds },
    ...(opts.board ? { board: opts.board } : {}),
    ...(opts.grade ? { grade: opts.grade } : {}),
  };
  const total = await prisma.user.count({ where });

  const students = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      board: true,
      grade: true,
    },
    skip: offset,
    take: limit,
  }) as UserRow[];

  const weekStart = await getCurrentWeekStart();
  const summaries = await prisma.weeklyStudentSummary.findMany({
    where: {
      studentId: { in: students.map((s: UserRow) => s.id) },
      weekStart: { gte: new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000) },
    },
    select: { studentId: true, weekStart: true },
    orderBy: { weekStart: 'desc' },
  }) as WeeklyStudentSummaryRow[];

  const latestByStudent = new Map<string, Date>();
  for (const s of summaries as WeeklyStudentSummaryRow[]) {
    if (!latestByStudent.has(s.studentId)) latestByStudent.set(s.studentId, s.weekStart);
  }

  const rows: ParentReportStudentRow[] = (students as UserRow[]).map((s: UserRow) => {
    const lastWeek = latestByStudent.get(s.id) ?? null;
    const hasReportThisWeek = lastWeek != null && lastWeek >= weekStart;
    return {
      studentId: s.id,
      studentEmail: s.email ?? null,
      studentName: s.name ?? null,
      board: s.board ?? null,
      grade: s.grade ?? null,
      lastReportWeekStart: lastWeek,
      hasReport: hasReportThisWeek,
    };
  });

  return { students: rows, total };
}

export async function getReportsPaused(): Promise<boolean> {
  const row = await prisma.adminConfig.findUnique({
    where: { key: CONFIG_KEY_REPORTS_PAUSED },
  });
  return row?.value === '1' || row?.value === 'true';
}

export async function setReportsPaused(paused: boolean): Promise<void> {
  await prisma.adminConfig.upsert({
    where: { key: CONFIG_KEY_REPORTS_PAUSED },
    create: { key: CONFIG_KEY_REPORTS_PAUSED, value: paused ? '1' : '0', updatedAt: new Date() },
    update: { value: paused ? '1' : '0', updatedAt: new Date() },
  });
}
