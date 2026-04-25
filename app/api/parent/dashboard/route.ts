/**
 * FILE OBJECTIVE:
 * - API endpoint for parent dashboard to view linked students' progress and activity.
 * - Read-optimized: uses weekly/subject/readiness/attention summary tables + safe rollups.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/parent/dashboard/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | created parent dashboard API
 * - 2026-03-03 | gpt | refactor to use summary tables + caching
 * - 2026-04-14T12:00:00Z | staff-engineer | fix: rename timezonesdiffer to timezonesDiffer for consistency
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import type { AppSession } from '@/lib/types/auth';
import { getRedis } from '@/lib/redis';

const CLASS_NAME = 'ParentDashboardAPI';

type WeeklyPoint = {
  weekStart: string;
  topicsCovered: number;
  testsTaken: number;
  averageScore: number;
  totalMinutes: number;
  sessionsCount: number;
  subjectsActive: string[];
};

type SubjectSummary = {
  subject: string;
  totalTopics: number;
  topicsCovered: number;
  coveragePercent: number;
  averageMastery: number;
  strongTopics: number;
  weakTopics: number;
  updatedAt: string;
};

type ReadinessSummary = {
  subject: string;
  coveragePercent: number;
  avgMastery: number;
  readinessScore: number;
  readinessLabel: string;
  updatedAt: string;
};

type MasteryDistribution = {
  masteryLevel: string;
  count: number;
};

type AttentionBySubject = {
  subject: string;
  count: number;
};

type StudentDashboard = {
  studentId: string;
  studentName: string;
  studentImage?: string;
  grade?: string;
  board?: string;
  subjects: string[];
  lastActiveAt?: string | null;
  attentionOpenCount: number;
  attentionBySubject: AttentionBySubject[];
  weekly: WeeklyPoint[];
  subjectProgress: SubjectSummary[];
  readiness: ReadinessSummary[];
  masteryDistribution: MasteryDistribution[];
  /** F-PAR-010 AC-05: student IANA timezone, included when it differs from parent timezone */
  studentTimezone?: string | null;
  /** F-PAR-010 AC-05: parent IANA timezone, included when it differs from student timezone */
  parentTimezone?: string | null;
};

type ParentDashboardResponse = {
  ok: true;
  isParent: boolean;
  totalStudents: number;
  generatedAt: string;
  students: StudentDashboard[];
};

const CACHE_TTL_SECONDS = 60;

function mondayUtcWeeksAgo(weeks: number): Date {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
  const day = d.getUTCDay(); // 0..6 (Sun..Sat)
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  d.setUTCDate(d.getUTCDate() - weeks * 7);
  return d;
}

/**
 * GET /api/parent/dashboard
 * Returns progress summary for all linked students
 */
export async function GET(req: NextRequest) {
  const start = Date.now();
  const METHOD_NAME = 'GET';

  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parentId = session.user.id;
    const cacheKey = `parent:dashboard:v2:${parentId}`;

    // Cache is best-effort; fall back to live query when Redis is unavailable.
    try {
      const redis = getRedis();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as ParentDashboardResponse;
        const response = NextResponse.json(parsed);
        logger.logAPI(
          req,
          response,
          { className: CLASS_NAME, methodName: METHOD_NAME, cache: 'hit' },
          start
        );
        return response;
      }
    } catch {
      // ignore cache errors
    }

    // Get all linked students (active links only)
    const parentRelations = await prisma.parentStudent.findMany({
      where: { parentId, status: 'active' },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            image: true,
            grade: true,
            board: true,
            subjects: true,
            timezone: true,
          },
        },
      },
    });

    if (parentRelations.length === 0) {
      const empty: ParentDashboardResponse = {
        ok: true,
        isParent: session.user.role === 'parent',
        students: [],
        totalStudents: 0,
        generatedAt: new Date().toISOString(),
      };
      const response = NextResponse.json(empty);
      logger.logAPI(req, response, { className: CLASS_NAME, methodName: METHOD_NAME }, start);
      return response;
    }

    const studentIds = parentRelations.map((r) => r.studentId);

    const since = mondayUtcWeeksAgo(12);

    const [
      weeklyRows,
      subjectRows,
      readinessRows,
      attentionCounts,
      masteryCounts,
      lastActiveRows,
      parentUser,
    ] = await Promise.all([
      prisma.weeklyStudentSummary.findMany({
        where: { studentId: { in: studentIds }, weekStart: { gte: since } },
        orderBy: [{ studentId: 'asc' }, { weekStart: 'desc' }],
      }),
      prisma.subjectProgressSummary.findMany({
        where: { studentId: { in: studentIds } },
        orderBy: [{ studentId: 'asc' }, { subject: 'asc' }],
      }),
      prisma.readinessStatus.findMany({
        where: { studentId: { in: studentIds } },
        orderBy: [{ studentId: 'asc' }, { subject: 'asc' }],
      }),
      prisma.attentionFlag.groupBy({
        by: ['studentId', 'subject'],
        where: { studentId: { in: studentIds }, resolved: false },
        _count: { id: true },
      }),
      prisma.studentTopicMastery.groupBy({
        by: ['studentId', 'masteryLevel'],
        where: { studentId: { in: studentIds } },
        _count: { id: true },
      }),
      prisma.learningSession.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds } },
        _max: { startedAt: true },
      }),
      prisma.user.findUnique({
        where: { id: parentId },
        select: { timezone: true },
      }),
    ]);

    const weeklyByStudent = new Map<string, WeeklyPoint[]>();
    for (const row of weeklyRows) {
      const arr = weeklyByStudent.get(row.studentId) ?? [];
      arr.push({
        weekStart: row.weekStart.toISOString(),
        topicsCovered: row.topicsCovered ?? 0,
        testsTaken: row.testsTaken ?? 0,
        averageScore: row.averageScore ?? 0,
        totalMinutes: row.totalMinutes ?? 0,
        sessionsCount: row.sessionsCount ?? 0,
        subjectsActive: Array.isArray(row.subjectsActive) ? (row.subjectsActive as string[]) : [],
      });
      weeklyByStudent.set(row.studentId, arr);
    }

    const subjectByStudent = new Map<string, SubjectSummary[]>();
    for (const row of subjectRows) {
      const arr = subjectByStudent.get(row.studentId) ?? [];
      const coveragePercent =
        row.totalTopics > 0 ? Math.round((row.topicsCovered / row.totalTopics) * 100) : 0;
      arr.push({
        subject: row.subject,
        totalTopics: row.totalTopics,
        topicsCovered: row.topicsCovered,
        coveragePercent,
        averageMastery: Math.round((row.averageMastery ?? 0) * 100) / 100,
        strongTopics: row.strongTopics,
        weakTopics: row.weakTopics,
        updatedAt: row.updatedAt.toISOString(),
      });
      subjectByStudent.set(row.studentId, arr);
    }

    const readinessByStudent = new Map<string, ReadinessSummary[]>();
    for (const row of readinessRows) {
      const arr = readinessByStudent.get(row.studentId) ?? [];
      arr.push({
        subject: row.subject,
        coveragePercent: row.coveragePercent,
        avgMastery: Math.round((row.avgMastery ?? 0) * 100) / 100,
        readinessScore: row.readinessScore,
        readinessLabel: row.readinessLabel,
        updatedAt: row.updatedAt.toISOString(),
      });
      readinessByStudent.set(row.studentId, arr);
    }

    const attentionByStudent = new Map<string, AttentionBySubject[]>();
    const attentionTotalByStudent = new Map<string, number>();
    for (const row of attentionCounts) {
      const arr = attentionByStudent.get(row.studentId) ?? [];
      const count = (row as any)?._count?.id ?? 0;
      arr.push({ subject: row.subject, count });
      attentionByStudent.set(row.studentId, arr);
      attentionTotalByStudent.set(
        row.studentId,
        (attentionTotalByStudent.get(row.studentId) ?? 0) + count
      );
    }

    const masteryByStudent = new Map<string, MasteryDistribution[]>();
    for (const row of masteryCounts) {
      const arr = masteryByStudent.get(row.studentId) ?? [];
      const count = (row as any)?._count?.id ?? 0;
      arr.push({ masteryLevel: row.masteryLevel, count });
      masteryByStudent.set(row.studentId, arr);
    }

    const lastActiveByStudent = new Map<string, string | null>();
    for (const row of lastActiveRows) {
      lastActiveByStudent.set(
        row.studentId,
        row._max.startedAt ? row._max.startedAt.toISOString() : null
      );
    }

    const students: StudentDashboard[] = parentRelations.map((rel) => {
      const s = rel.student;
      const weekly = weeklyByStudent.get(s.id) ?? [];
      const subjectProgress = subjectByStudent.get(s.id) ?? [];
      const readiness = readinessByStudent.get(s.id) ?? [];
      const attentionBySubject = (attentionByStudent.get(s.id) ?? []).sort(
        (a, b) => b.count - a.count
      );
      const masteryDistribution = masteryByStudent.get(s.id) ?? [];

      // F-PAR-010 AC-05: include both timezone strings when parent and student are in different zones
      const studentTz = (s as any).timezone ?? null;
      const parentTz = parentUser?.timezone ?? null;
      const timezonesDiffer = studentTz && parentTz && studentTz !== parentTz;

      return {
        studentId: s.id,
        studentName: s.name || 'Student',
        studentImage: s.image || undefined,
        grade: s.grade || undefined,
        board: s.board || undefined,
        subjects: Array.isArray(s.subjects) ? (s.subjects as string[]) : [],
        lastActiveAt: lastActiveByStudent.get(s.id) ?? null,
        attentionOpenCount: attentionTotalByStudent.get(s.id) ?? 0,
        attentionBySubject,
        weekly,
        subjectProgress,
        readiness,
        masteryDistribution,
        ...(timezonesDiffer ? { studentTimezone: studentTz, parentTimezone: parentTz } : {}),
      };
    });

    const payload: ParentDashboardResponse = {
      ok: true,
      isParent: true,
      students,
      totalStudents: students.length,
      generatedAt: new Date().toISOString(),
    };

    logger.info('Parent dashboard data fetched', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      parentId,
      studentCount: students.length,
    });

    // Best-effort cache set
    try {
      const redis = getRedis();
      await redis.set(cacheKey, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS);
    } catch {
      // ignore cache errors
    }

    const jsonResponse = NextResponse.json(payload);
    logger.logAPI(
      req,
      jsonResponse,
      { className: CLASS_NAME, methodName: METHOD_NAME, cache: 'miss' },
      start
    );
    return jsonResponse;
  } catch (error) {
    logger.error('Failed to fetch parent dashboard', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      error,
    });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}

// POST/DELETE linking actions intentionally live at /api/parent/link for clarity and auditing.
