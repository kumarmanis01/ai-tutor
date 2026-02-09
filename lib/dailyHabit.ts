/**
 * FILE OBJECTIVE:
 * - Daily Habit Engine (DHE): generates one personalized learning task per student per day
 * - Task types: learn, practice, revise, fix_gap, confidence
 * - 10-25 min estimated time, zero decision fatigue
 * - Auto-adjusts for missed days via Failure Recovery System
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created DHE with mastery-aware task selection
 */

import { prisma } from './prisma';
import { logger } from './logger';
// Types match Prisma enums — defined inline to avoid build dependency on prisma generate
type DailyTaskType = 'learn' | 'practice' | 'revise' | 'fix_gap' | 'confidence';
type DailyTaskStatus = 'pending' | 'completed' | 'skipped' | 'expired';

export interface DailyTaskResult {
  id: string;
  date: Date;
  taskType: DailyTaskType;
  title: string;
  description: string | null;
  topicId: string | null;
  subject: string | null;
  chapter: string | null;
  steps: unknown;
  estimatedTimeMin: number;
  status: DailyTaskStatus;
  completedAt: Date | null;
  skippedAt: Date | null;
  motivationMessage: string | null;
  isRecoveryTask: boolean;
}

/**
 * Get or generate today's daily task for a student.
 * Returns existing task if already created for today, otherwise generates a new one.
 */
export async function getDailyTask(studentId: string): Promise<DailyTaskResult | null> {
  const todayStart = getTodayUTC();

  // Check for existing task today
  const existing = await prisma.dailyTask.findUnique({
    where: { studentId_date: { studentId, date: todayStart } },
  });

  if (existing) {
    return existing as DailyTaskResult;
  }

  // Generate new task
  return generateDailyTask(studentId, todayStart);
}

/**
 * Mark today's daily task as completed
 */
export async function completeDailyTask(studentId: string): Promise<DailyTaskResult | null> {
  const todayStart = getTodayUTC();

  const task = await prisma.dailyTask.findUnique({
    where: { studentId_date: { studentId, date: todayStart } },
  });

  if (!task || task.status === 'completed') {
    return task as DailyTaskResult | null;
  }

  const motivation = pickMotivationMessage();

  const updated = await prisma.dailyTask.update({
    where: { id: task.id },
    data: {
      status: 'completed',
      completedAt: new Date(),
      motivationMessage: motivation,
    },
  });

  // Bump streak
  await bumpStreak(studentId);

  return updated as DailyTaskResult;
}

/**
 * Skip today's daily task
 */
export async function skipDailyTask(studentId: string): Promise<DailyTaskResult | null> {
  const todayStart = getTodayUTC();

  const task = await prisma.dailyTask.findUnique({
    where: { studentId_date: { studentId, date: todayStart } },
  });

  if (!task || task.status !== 'pending') {
    return task as DailyTaskResult | null;
  }

  const updated = await prisma.dailyTask.update({
    where: { id: task.id },
    data: {
      status: 'skipped',
      skippedAt: new Date(),
    },
  });

  return updated as DailyTaskResult;
}

/**
 * Expire yesterday's pending tasks (called by scheduler)
 */
export async function expireStaleTasks(): Promise<number> {
  const todayStart = getTodayUTC();

  const result = await prisma.dailyTask.updateMany({
    where: {
      status: 'pending',
      date: { lt: todayStart },
    },
    data: { status: 'expired' },
  });

  return result.count;
}

// ── Internal helpers ────────────────────────────────────────────────

async function generateDailyTask(studentId: string, todayStart: Date): Promise<DailyTaskResult | null> {
  try {
    const [user, mastery, recentTasks, streak] = await Promise.all([
      prisma.user.findUnique({
        where: { id: studentId },
        select: { board: true, grade: true, subjects: true, language: true },
      }),
      prisma.studentTopicMastery.findMany({
        where: { studentId },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.dailyTask.findMany({
        where: { studentId },
        orderBy: { date: 'desc' },
        take: 7,
      }),
      prisma.studentStreak.findFirst({
        where: { studentId, kind: 'daily' },
      }),
    ]);

    if (!user) return null;

    // Determine task type based on learning state
    const taskType = selectTaskType(mastery, recentTasks, streak);

    // Pick a topic for this task type
    const topicPick = await pickTopic(studentId, taskType, mastery, user, recentTasks);

    const estimatedTimeMin = estimateTime(taskType);
    const steps = buildSteps(taskType, topicPick);
    const title = buildTitle(taskType, topicPick);
    const description = buildDescription(taskType, topicPick);

    const task = await prisma.dailyTask.create({
      data: {
        studentId,
        date: todayStart,
        taskType,
        title,
        description,
        topicId: topicPick?.topicId ?? null,
        subject: topicPick?.subject ?? null,
        chapter: topicPick?.chapter ?? null,
        steps,
        estimatedTimeMin,
        status: 'pending',
        isRecoveryTask: false,
      },
    });

    logger.info('dailyHabit.generated', { studentId, taskType, topicId: topicPick?.topicId });
    return task as DailyTaskResult;
  } catch (error) {
    logger.error('dailyHabit.generateFailed', {
      studentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

interface TopicPick {
  topicId: string;
  topicName: string;
  subject: string;
  chapter: string;
  masteryLevel?: string;
  accuracy?: number;
}

function selectTaskType(
  mastery: { masteryLevel: string; accuracy: number; questionsAttempted: number }[],
  recentTasks: { taskType: DailyTaskType; status: DailyTaskStatus }[],
  streak: { current: number } | null,
): DailyTaskType {
  // If returning from inactivity (streak broken), start easy
  if (!streak || streak.current === 0) {
    return 'learn';
  }

  // Count weak topics (beginner with 3+ attempts)
  const weakTopics = mastery.filter(
    (m) => m.masteryLevel === 'beginner' && m.questionsAttempted >= 3,
  );

  // Count topics needing revision (intermediate, not attempted in 7+ days)
  const needsRevision = mastery.filter(
    (m) => m.masteryLevel === 'intermediate' || m.masteryLevel === 'advanced',
  );

  // Count strong topics for confidence tasks
  const strongTopics = mastery.filter(
    (m) => m.masteryLevel === 'advanced' || m.masteryLevel === 'expert',
  );

  // Get recent task types to avoid repetition
  const recentTypes = recentTasks.slice(0, 3).map((t) => t.taskType);

  // Priority: fix_gap > revise > practice > learn > confidence
  // But avoid repeating the same type 3 days in a row
  const typeCount = (t: DailyTaskType) => recentTypes.filter((r) => r === t).length;

  if (weakTopics.length > 0 && typeCount('fix_gap') < 2) {
    return 'fix_gap';
  }
  if (needsRevision.length > 0 && typeCount('revise') < 2) {
    return 'revise';
  }
  if (mastery.length > 0 && typeCount('practice') < 2) {
    return 'practice';
  }
  if (strongTopics.length >= 3 && typeCount('confidence') < 1) {
    return 'confidence';
  }
  return 'learn';
}

async function pickTopic(
  studentId: string,
  taskType: DailyTaskType,
  mastery: {
    topicId: string;
    subject: string;
    chapter: string;
    masteryLevel: string;
    accuracy: number;
    questionsAttempted: number;
    lastAttemptedAt: Date | null;
  }[],
  user: { board: string | null; grade: string | null; subjects: string[] },
  recentTasks: { topicId: string | null }[],
): Promise<TopicPick | null> {
  const recentTopicIds = new Set(recentTasks.map((t) => t.topicId).filter(Boolean));

  switch (taskType) {
    case 'fix_gap': {
      // Pick weakest topic not recently assigned
      const weak = mastery
        .filter((m) => m.masteryLevel === 'beginner' && m.questionsAttempted >= 3)
        .filter((m) => !recentTopicIds.has(m.topicId))
        .sort((a, b) => a.accuracy - b.accuracy);
      if (weak.length > 0) {
        const pick = weak[0];
        const name = await getTopicName(pick.topicId);
        return {
          topicId: pick.topicId,
          topicName: name,
          subject: pick.subject,
          chapter: pick.chapter,
          masteryLevel: pick.masteryLevel,
          accuracy: pick.accuracy,
        };
      }
      break;
    }

    case 'revise': {
      // Pick topic not attempted recently, intermediate/advanced mastery
      const revisable = mastery
        .filter((m) => m.masteryLevel === 'intermediate' || m.masteryLevel === 'advanced')
        .filter((m) => !recentTopicIds.has(m.topicId))
        .sort((a, b) => {
          // Prioritize older last-attempt dates (spaced repetition)
          const aTime = a.lastAttemptedAt?.getTime() ?? 0;
          const bTime = b.lastAttemptedAt?.getTime() ?? 0;
          return aTime - bTime;
        });
      if (revisable.length > 0) {
        const pick = revisable[0];
        const name = await getTopicName(pick.topicId);
        return {
          topicId: pick.topicId,
          topicName: name,
          subject: pick.subject,
          chapter: pick.chapter,
          masteryLevel: pick.masteryLevel,
          accuracy: pick.accuracy,
        };
      }
      break;
    }

    case 'practice': {
      // Pick any topic with some mastery for practice
      const practicable = mastery
        .filter((m) => !recentTopicIds.has(m.topicId))
        .sort((a, b) => a.accuracy - b.accuracy);
      if (practicable.length > 0) {
        const pick = practicable[0];
        const name = await getTopicName(pick.topicId);
        return {
          topicId: pick.topicId,
          topicName: name,
          subject: pick.subject,
          chapter: pick.chapter,
          masteryLevel: pick.masteryLevel,
          accuracy: pick.accuracy,
        };
      }
      break;
    }

    case 'confidence': {
      // Pick strong topic for a confidence boost
      const strong = mastery
        .filter((m) => m.masteryLevel === 'advanced' || m.masteryLevel === 'expert')
        .filter((m) => !recentTopicIds.has(m.topicId));
      if (strong.length > 0) {
        const pick = strong[Math.floor(Math.random() * strong.length)];
        const name = await getTopicName(pick.topicId);
        return {
          topicId: pick.topicId,
          topicName: name,
          subject: pick.subject,
          chapter: pick.chapter,
          masteryLevel: pick.masteryLevel,
          accuracy: pick.accuracy,
        };
      }
      break;
    }

    case 'learn':
    default: {
      // Find a new topic from curriculum that student hasn't attempted
      const masteredTopicIds = new Set(mastery.map((m) => m.topicId));

      if (user.board && user.grade) {
        const newTopic = await prisma.topicDef.findFirst({
          where: {
            id: { notIn: [...masteredTopicIds] },
            chapter: {
              subject: {
                class: {
                  board: { slug: user.board },
                  grade: parseInt(user.grade, 10),
                },
              },
            },
          },
          include: {
            chapter: {
              select: {
                name: true,
                slug: true,
                subject: { select: { name: true } },
              },
            },
          },
          orderBy: { order: 'asc' },
        });

        if (newTopic) {
          return {
            topicId: newTopic.id,
            topicName: newTopic.name,
            subject: newTopic.chapter.subject.name,
            chapter: newTopic.chapter.name,
          };
        }
      }
      break;
    }
  }

  // Fallback: pick first from mastery that wasn't recent
  const fallback = mastery.find((m) => !recentTopicIds.has(m.topicId));
  if (fallback) {
    const name = await getTopicName(fallback.topicId);
    return {
      topicId: fallback.topicId,
      topicName: name,
      subject: fallback.subject,
      chapter: fallback.chapter,
    };
  }

  return null;
}

async function getTopicName(topicId: string): Promise<string> {
  const topic = await prisma.topicDef.findUnique({
    where: { id: topicId },
    select: { name: true },
  });
  return topic?.name ?? 'Learning Topic';
}

function estimateTime(taskType: DailyTaskType): number {
  switch (taskType) {
    case 'learn':
      return 20;
    case 'practice':
      return 15;
    case 'revise':
      return 15;
    case 'fix_gap':
      return 25;
    case 'confidence':
      return 10;
    default:
      return 15;
  }
}

function buildSteps(taskType: DailyTaskType, topic: TopicPick | null): unknown {
  const topicLabel = topic?.topicName ?? 'your topic';

  switch (taskType) {
    case 'learn':
      return [
        { label: `Read the notes on ${topicLabel}`, done: false },
        { label: 'Try 3 practice questions', done: false },
        { label: 'Review what you learned', done: false },
      ];
    case 'practice':
      return [
        { label: `Solve 5 questions on ${topicLabel}`, done: false },
        { label: 'Check your answers', done: false },
        { label: 'Note any tricky parts', done: false },
      ];
    case 'revise':
      return [
        { label: `Quick recap of ${topicLabel}`, done: false },
        { label: 'Solve 3 questions without hints', done: false },
        { label: 'Compare with your last attempt', done: false },
      ];
    case 'fix_gap':
      return [
        { label: `Re-read the notes on ${topicLabel}`, done: false },
        { label: 'Try the easier questions first', done: false },
        { label: 'Then try 2 medium questions', done: false },
        { label: 'Track what clicked this time', done: false },
      ];
    case 'confidence':
      return [
        { label: `Quick test on ${topicLabel}`, done: false },
        { label: 'Aim for speed and accuracy', done: false },
      ];
    default:
      return [{ label: 'Complete your daily task', done: false }];
  }
}

function buildTitle(taskType: DailyTaskType, topic: TopicPick | null): string {
  const topicLabel = topic?.topicName ?? 'Something New';

  switch (taskType) {
    case 'learn':
      return `Learn: ${topicLabel}`;
    case 'practice':
      return `Practice: ${topicLabel}`;
    case 'revise':
      return `Quick Revision: ${topicLabel}`;
    case 'fix_gap':
      return `Let's Work On: ${topicLabel}`;
    case 'confidence':
      return `Show What You Know: ${topicLabel}`;
    default:
      return `Today's Task: ${topicLabel}`;
  }
}

function buildDescription(taskType: DailyTaskType, _topic: TopicPick | null): string {
  switch (taskType) {
    case 'learn':
      return 'Discover something new today. Read through the notes and try a few questions to get started.';
    case 'practice':
      return 'Sharpen your skills with focused practice. You\'ve got this!';
    case 'revise':
      return 'A quick revisit to keep things fresh. Spaced repetition makes learning stick.';
    case 'fix_gap':
      return 'This topic needs a bit more attention. Take it slow — understanding beats speed.';
    case 'confidence':
      return 'You\'re strong here! A quick test to prove it to yourself.';
    default:
      return 'Your personalized task for today.';
  }
}

function pickMotivationMessage(): string {
  const messages = [
    'Great work today! Every session adds up.',
    'You showed up and that matters. Keep it going!',
    'Another day, another step forward. Well done!',
    'Consistency is your superpower. See you tomorrow!',
    'Done for the day! Your future self will thank you.',
    'Small steps, big results. You\'re building something great.',
    'That\'s the way! Learning is a journey, not a sprint.',
    'You crushed it! Rest up and come back strong tomorrow.',
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

async function bumpStreak(studentId: string): Promise<void> {
  try {
    const streak = await prisma.studentStreak.findFirst({
      where: { studentId, kind: 'daily' },
    });

    if (streak) {
      const newCurrent = streak.current + 1;
      await prisma.studentStreak.update({
        where: { id: streak.id },
        data: {
          current: newCurrent,
          best: Math.max(newCurrent, streak.best),
          lastActive: new Date(),
        },
      });
    } else {
      await prisma.studentStreak.create({
        data: {
          studentId,
          kind: 'daily',
          current: 1,
          best: 1,
          lastActive: new Date(),
        },
      });
    }
  } catch (error) {
    logger.error('dailyHabit.bumpStreak.failed', {
      studentId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function getTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
