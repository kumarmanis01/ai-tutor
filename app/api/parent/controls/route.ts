export const dynamic = 'force-dynamic'

/**
 * FILE OBJECTIVE:
 * - Parent controls API: manage screen time, subject toggles, focus mode per child.
 * - Also stores weekly study hours target and preferred schedule slot (F-PAR-002 AC-02).
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created parent controls API
 * - 2026-02-07 | copilot | added force-dynamic to prevent static render error
 * - 2026-04-14 | claude | added weeklyHoursTarget + schedulePreference (F-PAR-002 AC-02)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { consumeShield } from '@/lib/student/streakShield';
import { formatErrorForResponse } from '@/lib/errorResponse';
import type { AppSession } from '@/lib/types/auth';

const CLASS_NAME = 'ParentControlsAPI';

/**
 * GET /api/parent/controls?studentId=xxx
 * Fetch current controls for a specific child
 */
export async function GET(req: NextRequest) {
  const start = Date.now();

  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studentId = req.nextUrl.searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 });
    }

    const parentId = session.user.id;

    // Verify active link
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });
    if (!link || link.status !== 'active') {
      return NextResponse.json({ error: 'Student not linked' }, { status: 403 });
    }

    const controls = await prisma.parentChildControl.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });

    const response = NextResponse.json({
      controls: controls || {
        dailyTimeLimitMin: null,
        allowedSubjects: [],
        focusMode: 'balanced',
        studyHoursStart: null,
        studyHoursEnd: null,
        weeklyHoursTarget: null,
        schedulePreference: null,
        topicFocusRequest: null,
      },
    });

    logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'GET' }, start);
    return response;
  } catch (error) {
    logger.error('Fetch controls failed', { className: CLASS_NAME, error });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}

/**
 * PUT /api/parent/controls
 * Update controls for a child
 */
export async function PUT(req: NextRequest) {
  const start = Date.now();

  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      studentId,
      dailyTimeLimitMin,
      allowedSubjects,
      focusMode,
      studyHoursStart,
      studyHoursEnd,
      // F-PAR-002 AC-02: weekly hours target and preferred study schedule slot
      weeklyHoursTarget,
      schedulePreference,
      // F-PAR-002 AC-03: topic-focus preference submitted by parent for AI to consider
      topicFocusRequest,
      // Pause controls
      isPaused,
      pausedUntil,
      pauseReason,
    } = body;

    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 });
    }

    const parentId = session.user.id;

    // Verify active link
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });
    if (!link || link.status !== 'active') {
      return NextResponse.json({ error: 'Student not linked' }, { status: 403 });
    }

    // Validate focus mode
    const validFocusModes = ['balanced', 'exam_prep', 'concept_focus'];
    if (focusMode && !validFocusModes.includes(focusMode)) {
      return NextResponse.json({ error: 'Invalid focusMode' }, { status: 400 });
    }

    // Validate time limit
    if (dailyTimeLimitMin !== null && dailyTimeLimitMin !== undefined) {
      if (typeof dailyTimeLimitMin !== 'number' || dailyTimeLimitMin < 15 || dailyTimeLimitMin > 480) {
        return NextResponse.json({ error: 'dailyTimeLimitMin must be 15-480 minutes' }, { status: 400 });
      }
    }

    // Validate weeklyHoursTarget (F-PAR-002 AC-02)
    if (weeklyHoursTarget !== null && weeklyHoursTarget !== undefined) {
      if (typeof weeklyHoursTarget !== 'number' || weeklyHoursTarget < 1 || weeklyHoursTarget > 70) {
        return NextResponse.json({ error: 'weeklyHoursTarget must be 1-70 hours' }, { status: 400 });
      }
    }

    // Validate schedulePreference (F-PAR-002 AC-02)
    const VALID_SCHEDULE_PREFS = ['morning', 'afternoon', 'evening'];
    if (schedulePreference !== null && schedulePreference !== undefined) {
      if (!VALID_SCHEDULE_PREFS.includes(schedulePreference)) {
        return NextResponse.json({ error: 'schedulePreference must be morning, afternoon, or evening' }, { status: 400 });
      }
    }

    // Validate topicFocusRequest (F-PAR-002 AC-03): free-text, max 500 chars
    if (topicFocusRequest !== null && topicFocusRequest !== undefined) {
      if (typeof topicFocusRequest !== 'string' || topicFocusRequest.length > 500) {
        return NextResponse.json({ error: 'topicFocusRequest must be a string up to 500 characters' }, { status: 400 });
      }
    }

    const controls = await prisma.parentChildControl.upsert({
      where: { parentId_studentId: { parentId, studentId } },
      update: {
        ...(dailyTimeLimitMin !== undefined && { dailyTimeLimitMin }),
        ...(allowedSubjects !== undefined && { allowedSubjects }),
        ...(focusMode !== undefined && { focusMode }),
        ...(studyHoursStart !== undefined && { studyHoursStart }),
        ...(studyHoursEnd !== undefined && { studyHoursEnd }),
        ...(weeklyHoursTarget !== undefined && { weeklyHoursTarget: weeklyHoursTarget ?? null }),
        ...(schedulePreference !== undefined && { schedulePreference: schedulePreference ?? null }),
        ...(topicFocusRequest !== undefined && { topicFocusRequest: topicFocusRequest ?? null }),
        ...(isPaused !== undefined && { isPaused }),
        ...(pausedUntil !== undefined && { pausedUntil: pausedUntil ? new Date(pausedUntil) : null }),
        ...(pauseReason !== undefined && { pauseReason }),
      },
      create: {
        parentId,
        studentId,
        dailyTimeLimitMin: dailyTimeLimitMin ?? null,
        allowedSubjects: allowedSubjects ?? [],
        focusMode: focusMode ?? 'balanced',
        studyHoursStart: studyHoursStart ?? null,
        studyHoursEnd: studyHoursEnd ?? null,
        weeklyHoursTarget: weeklyHoursTarget ?? null,
        schedulePreference: schedulePreference ?? null,
        topicFocusRequest: topicFocusRequest ?? null,
        isPaused: isPaused ?? false,
        pausedUntil: pausedUntil ? new Date(pausedUntil) : null,
        pauseReason: pauseReason ?? null,
      },
    });

    // If parent paused the child, consume the streak shield to preserve streaks for the month.
    if (isPaused === true) {
      consumeShield(studentId).catch((err) => {
        logger.warn('streak shield consume failed during pause', { studentId, err: String(err) });
      });
    }

    // Audit
    await prisma.auditLog.create({
      data: {
        adminId: parentId,
        targetEntity: 'User',
        targetId: studentId,
        action: null,
        details: { legacyAction: 'parent_update_controls', controls: { dailyTimeLimitMin, allowedSubjects, focusMode, studyHoursStart, studyHoursEnd } },
      },
    }).catch((err) => logger.warn('audit log failed', { error: String(err) }));

    logger.info('Parent controls updated', { className: CLASS_NAME, parentId, studentId });

    const response = NextResponse.json({ ok: true, controls });
    logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'PUT' }, start);
    return response;
  } catch (error) {
    logger.error('Update controls failed', { className: CLASS_NAME, error });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}
