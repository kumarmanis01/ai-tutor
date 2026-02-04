/**
 * FILE OBJECTIVE:
 * - GET: Retrieve (or auto-generate) today's daily task for the logged-in student
 * - POST: Mark task as completed or skipped
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created daily task API endpoint for DHE
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getDailyTask, completeDailyTask, skipDailyTask } from '@/lib/dailyHabit';
import { logger } from '@/lib/logger';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const task = await getDailyTask(session.user.id);
  return NextResponse.json({ task });
}

export async function POST(request: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body;
  if (action !== 'complete' && action !== 'skip') {
    return NextResponse.json({ error: 'action must be "complete" or "skip"' }, { status: 400 });
  }

  const studentId = session.user.id;

  if (action === 'complete') {
    const task = await completeDailyTask(studentId);
    logger.info('dailyTask.completed', { studentId });
    return NextResponse.json({ task });
  }

  const task = await skipDailyTask(studentId);
  logger.info('dailyTask.skipped', { studentId });
  return NextResponse.json({ task });
}
