/**
 * FILE OBJECTIVE:
 * - Returns today's daily plan slots and assignments.
 * - Reads from DailyTask records for the student.
 *
 * EDIT LOG:
 * - 2026-02-22 | claude | created — returns real DailyTask data
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

function utcMidnightToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const session = await getServerSessionForHandlers();
  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ slots: [], assignments: [] }, { status: 401 });
  }

  const todayStart = utcMidnightToday();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  const tasks = await prisma.dailyTask.findMany({
    where: {
      studentId: userId,
      date: { gte: todayStart, lt: tomorrowStart },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      taskType: true,
      subject: true,
      chapter: true,
      description: true,
      estimatedTimeMin: true,
      status: true,
    },
  });

  const slots = tasks.map((t) => ({
    id: t.id,
    subject: t.subject ?? '',
    chapter: t.chapter ?? '',
    description: t.description ?? '',
    taskType: t.taskType,
    estimatedTimeMin: t.estimatedTimeMin ?? 0,
    status: t.status,
  }));

  return NextResponse.json({ slots, assignments: [] });
}
