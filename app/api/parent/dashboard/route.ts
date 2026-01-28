/**
 * FILE OBJECTIVE:
 * - API endpoint for parent dashboard to view linked students' progress and activity.
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
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import type { AppSession } from '@/lib/types/auth';

const CLASS_NAME = 'ParentDashboardAPI';

/**
 * Student progress summary for parent view
 */
interface StudentProgressSummary {
  studentId: string;
  studentName: string;
  studentImage?: string;
  grade?: string;
  board?: string;
  subjects: string[];
  stats: {
    totalLessonsCompleted: number;
    totalTestsTaken: number;
    averageTestScore: number;
    totalLearningMinutes: number;
    sessionsThisWeek: number;
    lastActiveAt?: string;
  };
  recentActivity: {
    type: string;
    description: string;
    timestamp: string;
  }[];
  weeklyProgress: {
    date: string;
    lessonsCompleted: number;
    testsTaken: number;
    minutesLearned: number;
  }[];
}

interface ParentDashboardResponse {
  isParent: boolean;
  students: StudentProgressSummary[];
  totalStudents: number;
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

    // Get all linked students
    const parentRelations = await prisma.parentStudent.findMany({
      where: { parentId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            image: true,
            grade: true,
            board: true,
            subjects: true,
          },
        },
      },
    });

    if (parentRelations.length === 0) {
      const response = NextResponse.json({
        isParent: false,
        students: [],
        totalStudents: 0,
      });
      logger.logAPI(req, response, { className: CLASS_NAME, methodName: METHOD_NAME }, start);
      return response;
    }

    const studentIds = parentRelations.map((r) => r.studentId);

    // Fetch all student data in parallel
    const [
      lessonProgressByStudent,
      testAttemptsByStudent,
      learningSessionsByStudent,
    ] = await Promise.all([
      // Lesson progress
      prisma.lessonProgress.groupBy({
        by: ['userId'],
        where: {
          userId: { in: studentIds },
          completed: true,
        },
        _count: { id: true },
      }),
      // Test attempts with scores
      prisma.testAttempt.findMany({
        where: {
          userId: { in: studentIds },
        },
        select: {
          userId: true,
          score: true,
          totalQuestions: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Learning sessions
      prisma.learningSession.findMany({
        where: {
          studentId: { in: studentIds },
        },
        select: {
          studentId: true,
          duration: true,
          activityType: true,
          activityRef: true,
          startedAt: true,
          createdAt: true,
        },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    // Build progress summary for each student
    const students: StudentProgressSummary[] = await Promise.all(
      parentRelations.map(async (relation) => {
        const student = relation.student;
        const studentId = student.id;

        // Calculate stats
        const lessonCount = lessonProgressByStudent.find((l) => l.userId === studentId)?._count?.id || 0;
        const testAttempts = testAttemptsByStudent.filter((t) => t.userId === studentId);
        const sessions = learningSessionsByStudent.filter((s) => s.studentId === studentId);

        const averageScore = testAttempts.length > 0
          ? testAttempts.reduce((sum, t) => sum + (t.score || 0) / (t.totalQuestions || 1) * 100, 0) / testAttempts.length
          : 0;

        const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const sessionsThisWeek = sessions.filter((s) => new Date(s.startedAt) >= oneWeekAgo).length;

        const lastSession = sessions[0];
        const lastActiveAt = lastSession?.startedAt?.toISOString();

        // Get recent activity (last 10 items)
        const recentActivity = sessions.slice(0, 10).map((s) => ({
          type: s.activityType,
          description: `${s.activityType} activity${s.activityRef ? `: ${s.activityRef}` : ''}`,
          timestamp: s.startedAt.toISOString(),
        }));

        // Calculate weekly progress for chart
        const weeklyProgress: StudentProgressSummary['weeklyProgress'] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          const dayStart = new Date(dateStr);
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);

          const dayLessons = await prisma.lessonProgress.count({
            where: {
              userId: studentId,
              completed: true,
              updatedAt: {
                gte: dayStart,
                lt: dayEnd,
              },
            },
          });

          const dayTests = testAttempts.filter((t) => {
            const created = new Date(t.createdAt);
            return created >= dayStart && created < dayEnd;
          }).length;

          const daySessions = sessions.filter((s) => {
            const started = new Date(s.startedAt);
            return started >= dayStart && started < dayEnd;
          });
          const dayMinutes = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0);

          weeklyProgress.push({
            date: dateStr,
            lessonsCompleted: dayLessons,
            testsTaken: dayTests,
            minutesLearned: dayMinutes,
          });
        }

        return {
          studentId,
          studentName: student.name || 'Student',
          studentImage: student.image || undefined,
          grade: student.grade || undefined,
          board: student.board || undefined,
          subjects: student.subjects || [],
          stats: {
            totalLessonsCompleted: lessonCount,
            totalTestsTaken: testAttempts.length,
            averageTestScore: Math.round(averageScore),
            totalLearningMinutes: totalMinutes,
            sessionsThisWeek,
            lastActiveAt,
          },
          recentActivity,
          weeklyProgress,
        };
      })
    );

    const response: ParentDashboardResponse = {
      isParent: true,
      students,
      totalStudents: students.length,
    };

    logger.info('Parent dashboard data fetched', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      parentId,
      studentCount: students.length,
    });

    const jsonResponse = NextResponse.json(response);
    logger.logAPI(req, jsonResponse, { className: CLASS_NAME, methodName: METHOD_NAME }, start);
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

/**
 * POST /api/parent/dashboard
 * Link a student to parent account using invite code
 */
export async function POST(req: NextRequest) {
  const start = Date.now();
  const METHOD_NAME = 'POST';

  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { studentEmail, inviteCode } = body;

    if (!studentEmail && !inviteCode) {
      return NextResponse.json({ error: 'studentEmail or inviteCode required' }, { status: 400 });
    }

    const parentId = session.user.id;

    // Find student by email
    let student;
    if (studentEmail) {
      student = await prisma.user.findUnique({
        where: { email: studentEmail },
      });
    }
    // TODO: Implement invite code lookup
    // else if (inviteCode) { ... }

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Check if already linked
    const existingRelation = await prisma.parentStudent.findUnique({
      where: {
        parentId_studentId: {
          parentId,
          studentId: student.id,
        },
      },
    });

    if (existingRelation) {
      return NextResponse.json({ error: 'Already linked to this student' }, { status: 409 });
    }

    // Create link
    await prisma.parentStudent.create({
      data: {
        parentId,
        studentId: student.id,
      },
    });

    logger.info('Parent-student link created', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      parentId,
      studentId: student.id,
    });

    const response = NextResponse.json({ ok: true, studentId: student.id });
    logger.logAPI(req, response, { className: CLASS_NAME, methodName: METHOD_NAME }, start);
    return response;
  } catch (error) {
    logger.error('Failed to link student', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      error,
    });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}

/**
 * DELETE /api/parent/dashboard
 * Unlink a student from parent account
 */
export async function DELETE(req: NextRequest) {
  const start = Date.now();
  const METHOD_NAME = 'DELETE';

  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 });
    }

    const parentId = session.user.id;

    await prisma.parentStudent.delete({
      where: {
        parentId_studentId: {
          parentId,
          studentId,
        },
      },
    });

    logger.info('Parent-student link removed', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      parentId,
      studentId,
    });

    const response = NextResponse.json({ ok: true });
    logger.logAPI(req, response, { className: CLASS_NAME, methodName: METHOD_NAME }, start);
    return response;
  } catch (error) {
    logger.error('Failed to unlink student', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      error,
    });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}
