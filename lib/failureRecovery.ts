/**
 * FILE OBJECTIVE:
 * - Failure Recovery System (FRS): detects student inactivity and generates
 *   graduated re-engagement events.
 * - 3 days  → gentle_nudge (encouraging message)
 * - 7 days  → easy_task   (low-effort recovery daily task)
 * - 14 days → fresh_start (reset streak expectations, ultra-easy task)
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created FRS with graduated re-engagement
 */

import { prisma } from './prisma';
import { logger } from './logger';
// Type matches Prisma enum — defined inline to avoid build dependency on prisma generate
type RecoveryNudgeType = 'gentle_nudge' | 'easy_task' | 'fresh_start';

const THRESHOLDS: { days: number; nudgeType: RecoveryNudgeType }[] = [
  { days: 14, nudgeType: 'fresh_start' },
  { days: 7, nudgeType: 'easy_task' },
  { days: 3, nudgeType: 'gentle_nudge' },
];

/**
 * Scan all students for inactivity and create recovery events.
 * Called by the scheduler daily.
 */
export async function runRecoveryCheck(): Promise<number> {
  const now = new Date();
  let eventsCreated = 0;

  // Find all students with a streak record (indicates they've been active before)
  const streaks = await prisma.studentStreak.findMany({
    where: { kind: 'daily' },
    select: {
      studentId: true,
      lastActive: true,
      current: true,
    },
  });

  for (const streak of streaks) {
    if (!streak.lastActive) continue;

    const inactiveDays = Math.floor(
      (now.getTime() - streak.lastActive.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Skip if active recently (less than 3 days)
    if (inactiveDays < 3) continue;

    // Determine which nudge tier applies
    const tier = THRESHOLDS.find((t) => inactiveDays >= t.days);
    if (!tier) continue;

    try {
      // Check if we already sent this nudge type for this inactivity period
      const alreadySent = await prisma.recoveryEvent.findFirst({
        where: {
          studentId: streak.studentId,
          nudgeType: tier.nudgeType,
          sentAt: { gte: getWeekAgo() },
        },
      });

      if (alreadySent) continue;

      // Create recovery event
      const recoveryEvent = await prisma.recoveryEvent.create({
        data: {
          studentId: streak.studentId,
          inactiveDays,
          nudgeType: tier.nudgeType,
        },
      });

      // For easy_task and fresh_start, generate a recovery daily task
      if (tier.nudgeType !== 'gentle_nudge') {
        await generateRecoveryTask(streak.studentId, tier.nudgeType, recoveryEvent.id);
      }

      // Reset streak to 0 if fresh_start
      if (tier.nudgeType === 'fresh_start' && streak.current > 0) {
        await prisma.studentStreak.updateMany({
          where: { studentId: streak.studentId, kind: 'daily' },
          data: { current: 0 },
        });
      }

      eventsCreated++;
      logger.info('failureRecovery.eventCreated', {
        studentId: streak.studentId,
        nudgeType: tier.nudgeType,
        inactiveDays,
      });
    } catch (error) {
      logger.error('failureRecovery.studentCheckFailed', {
        studentId: streak.studentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('failureRecovery.scanCompleted', { eventsCreated });
  return eventsCreated;
}

/**
 * Get pending recovery events for a student (shown on dashboard)
 */
export async function getRecoveryNudge(studentId: string): Promise<{
  nudgeType: RecoveryNudgeType;
  message: string;
  inactiveDays: number;
  dailyTaskId: string | null;
} | null> {
  const event = await prisma.recoveryEvent.findFirst({
    where: {
      studentId,
      respondedAt: null,
      dismissed: false,
    },
    orderBy: { sentAt: 'desc' },
  });

  if (!event) return null;

  return {
    nudgeType: event.nudgeType,
    message: getRecoveryMessage(event.nudgeType, event.inactiveDays),
    inactiveDays: event.inactiveDays,
    dailyTaskId: event.dailyTaskId,
  };
}

/**
 * Mark a recovery event as responded to (student returned)
 */
export async function markRecoveryResponded(studentId: string): Promise<void> {
  await prisma.recoveryEvent.updateMany({
    where: {
      studentId,
      respondedAt: null,
      dismissed: false,
    },
    data: { respondedAt: new Date() },
  });
}

/**
 * Dismiss a recovery nudge
 */
export async function dismissRecoveryNudge(studentId: string, eventId: string): Promise<void> {
  await prisma.recoveryEvent.update({
    where: { id: eventId },
    data: { dismissed: true },
  });
}

// ── Internal helpers ────────────────────────────────────────────────

async function generateRecoveryTask(
  studentId: string,
  nudgeType: RecoveryNudgeType,
  recoveryEventId: string,
): Promise<void> {
  const todayStart = getTodayUTC();

  // Don't overwrite an existing daily task
  const existing = await prisma.dailyTask.findUnique({
    where: { studentId_date: { studentId, date: todayStart } },
  });
  if (existing) {
    // Link the recovery event to existing task
    await prisma.recoveryEvent.update({
      where: { id: recoveryEventId },
      data: { dailyTaskId: existing.id },
    });
    return;
  }

  // Pick an easy topic from mastery (something they know well)
  const easyTopic = await prisma.studentTopicMastery.findFirst({
    where: {
      studentId,
      masteryLevel: { in: ['intermediate', 'advanced'] },
    },
    orderBy: { accuracy: 'desc' },
  });

  const topicName = easyTopic
    ? await getTopicName(easyTopic.topicId)
    : 'Quick Review';

  const isFreshStart = nudgeType === 'fresh_start';
  const taskType = isFreshStart ? 'confidence' : 'revise';
  const estimatedTime = isFreshStart ? 10 : 15;

  const task = await prisma.dailyTask.create({
    data: {
      studentId,
      date: todayStart,
      taskType,
      title: isFreshStart
        ? `Welcome Back: ${topicName}`
        : `Easy Warm-Up: ${topicName}`,
      description: isFreshStart
        ? 'No pressure. Just a quick refresh to get back in the groove.'
        : 'A gentle warm-up to ease you back in. You\'ve done this before!',
      topicId: easyTopic?.topicId ?? null,
      subject: easyTopic?.subject ?? null,
      chapter: easyTopic?.chapter ?? null,
      steps: isFreshStart
        ? [
            { label: 'Read through the summary', done: false },
            { label: 'Try 2 easy questions', done: false },
          ]
        : [
            { label: 'Quick recap of the topic', done: false },
            { label: 'Solve 3 familiar questions', done: false },
            { label: 'Check your answers', done: false },
          ],
      estimatedTimeMin: estimatedTime,
      isRecoveryTask: true,
    },
  });

  // Link recovery event to the generated task
  await prisma.recoveryEvent.update({
    where: { id: recoveryEventId },
    data: { dailyTaskId: task.id },
  });
}

function getRecoveryMessage(nudgeType: RecoveryNudgeType, inactiveDays: number): string {
  switch (nudgeType) {
    case 'gentle_nudge':
      return 'Hey! We noticed you\'ve been away. Even 10 minutes of learning today can keep your progress going.';
    case 'easy_task':
      return `It's been ${inactiveDays} days. We've prepared a super easy warm-up just for you — no pressure!`;
    case 'fresh_start':
      return 'Welcome back! We\'ve reset your streak so you can start fresh. Here\'s an easy task to get going again.';
    default:
      return 'Ready to pick up where you left off?';
  }
}

async function getTopicName(topicId: string): Promise<string> {
  const topic = await prisma.topicDef.findUnique({
    where: { id: topicId },
    select: { name: true },
  });
  return topic?.name ?? 'Quick Review';
}

function getTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function getWeekAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
}
