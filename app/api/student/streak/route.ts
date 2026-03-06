/**
 * FILE OBJECTIVE:
 * - GET /api/student/streak
 * - Returns the student's current and longest daily study streak.
 *
 * EDIT LOG:
 * - 2026-03-06 | claude | created for daily streak tracking feature
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const streak = await prisma.studentStreak.findFirst({
    where: { studentId: session.user.id, kind: 'daily' },
    select: { current: true, best: true, lastActive: true },
  });

  return NextResponse.json({
    currentStreak: streak?.current ?? 0,
    longestStreak: streak?.best ?? 0,
    lastStudyDate: streak?.lastActive ?? null,
  });
}
