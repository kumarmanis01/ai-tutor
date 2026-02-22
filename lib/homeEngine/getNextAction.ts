/**
 * FILE OBJECTIVE:
 * - Deterministic Home Tutor Engine.
 * - Returns a single, rule-prioritised next action for the student.
 * - ZERO AI calls. Prisma only. Target latency: <150 ms.
 *
 * Priority order (short-circuits at first match):
 *   P1 – Resume unfinished LearningSession
 *   P2 – Pending DailyTask for today
 *   P3 – Unresolved AttentionFlag (lowest accuracy first)
 *   P4 – StudentTopicMastery with accuracy < 0.6 (lowest first)
 *   P5 – First unattempted TopicDef in the student's curriculum
 *
 * DO NOT modify the existing recommendation engine.
 * DO NOT change the Prisma schema.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created deterministic tutor engine per architectural spec
 */

import { prisma } from '@/lib/prisma';
import { MasteryLevel } from '@prisma/client';

// ─── Public types ────────────────────────────────────────────────────────────

export type ActionType = 'notes' | 'practice';

export type RuleId =
  | 'resume_session'
  | 'daily_task'
  | 'low_mastery'
  | 'low_accuracy'
  | 'next_new_topic';

export interface NextAction {
  topicId: string | null;
  subject: string | null;
  chapter: string | null;
  ruleId: RuleId;
  reasonLabel: string;
  actionType: ActionType;
  masteryLevel?: MasteryLevel;
  accuracy?: number;
  /** Present only for resume_session — used to build /practice/session/[id] URL */
  sessionId?: string;
  /** Present only for daily_task — estimated minutes for the task */
  estimatedTimeMin?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeObj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function strOrNull(v: unknown): string | null {
  if (typeof v === 'string' && v.length > 0) return v;
  return null;
}

/** Maps LearningSession.activityType → ActionType */
function sessionToAction(activityType: string): ActionType {
  const t = activityType.toLowerCase();
  if (t === 'practice' || t === 'test' || t === 'quiz') return 'practice';
  return 'notes';
}

/**
 * Maps DailyTaskType → ActionType.
 * learn, revise → notes | practice, fix_gap, confidence → practice
 */
function dailyTaskToAction(taskType: string): ActionType {
  if (taskType === 'practice' || taskType === 'fix_gap' || taskType === 'confidence') {
    return 'practice';
  }
  return 'notes';
}

/** Returns today's UTC midnight as a Date */
function utcMidnightToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ─── Priority sub-functions ───────────────────────────────────────────────────

/**
 * P1 — Resume the most recently accessed incomplete LearningSession.
 * Pulls subject/chapter/topicId from the session's meta JSON.
 */
async function p1_resumeSession(studentId: string): Promise<NextAction | null> {
  const session = await prisma.learningSession.findFirst({
    where: { studentId, isCompleted: false },
    orderBy: { lastAccessed: 'desc' },
    select: {
      id: true,
      activityType: true,
      activityRef: true,
      meta: true,
    },
  });
  if (!session) return null;

  const meta = safeObj(session.meta);
  return {
    topicId: strOrNull(session.activityRef) ?? strOrNull(meta.topicId) ?? null,
    subject: strOrNull(meta.subject) ?? strOrNull(meta.subjectName) ?? null,
    chapter: strOrNull(meta.chapter) ?? strOrNull(meta.chapterName) ?? null,
    ruleId: 'resume_session',
    reasonLabel: 'Resume where you left off',
    actionType: sessionToAction(session.activityType),
    sessionId: session.id,
  };
}

/**
 * P2 — Today's pending DailyTask.
 * Uses UTC date window to match the stored calendar date.
 */
async function p2_dailyTask(studentId: string): Promise<NextAction | null> {
  const todayStart = utcMidnightToday();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  const task = await prisma.dailyTask.findFirst({
    where: {
      studentId,
      status: 'pending',
      date: { gte: todayStart, lt: tomorrowStart },
    },
    select: {
      taskType: true,
      topicId: true,
      subject: true,
      chapter: true,
      description: true,
      estimatedTimeMin: true,
    },
  });
  if (!task) return null;

  return {
    topicId: task.topicId ?? null,
    subject: task.subject ?? null,
    chapter: task.chapter ?? null,
    ruleId: 'daily_task',
    reasonLabel: task.description ?? "Today's learning task",
    actionType: dailyTaskToAction(task.taskType),
    estimatedTimeMin: task.estimatedTimeMin,
  };
}

/**
 * P3 — Unresolved AttentionFlag, sorted by lowest accuracy first.
 * These flags are written by the analytics pipeline when mastery drops.
 */
async function p3_attentionFlag(studentId: string): Promise<NextAction | null> {
  const flag = await prisma.attentionFlag.findFirst({
    where: { studentId, resolved: false },
    orderBy: { accuracy: 'asc' },
    select: {
      topicId: true,
      subject: true,
      chapter: true,
      masteryLevel: true,
      accuracy: true,
    },
  });
  if (!flag) return null;

  return {
    topicId: flag.topicId,
    subject: flag.subject,
    chapter: flag.chapter,
    ruleId: 'low_mastery',
    reasonLabel: `Revise ${flag.subject} – ${flag.chapter}`,
    actionType: 'practice',
    masteryLevel: flag.masteryLevel,
    accuracy: flag.accuracy,
  };
}

/**
 * P4 — StudentTopicMastery with accuracy below 0.6, worst first.
 * Catches cases where AttentionFlags haven't been written yet.
 */
async function p4_lowAccuracy(studentId: string): Promise<NextAction | null> {
  const weak = await prisma.studentTopicMastery.findFirst({
    where: { studentId, accuracy: { lt: 0.6 } },
    orderBy: { accuracy: 'asc' },
    select: {
      topicId: true,
      subject: true,
      chapter: true,
      masteryLevel: true,
      accuracy: true,
    },
  });
  if (!weak) return null;

  return {
    topicId: weak.topicId,
    subject: weak.subject,
    chapter: weak.chapter,
    ruleId: 'low_accuracy',
    reasonLabel: `Practice ${weak.subject} – ${weak.chapter}`,
    actionType: 'practice',
    masteryLevel: weak.masteryLevel,
    accuracy: weak.accuracy,
  };
}

/**
 * P5 — First unattempted TopicDef in the student's curriculum.
 * Scopes to the student's board + grade + subjects.
 * Returns null if curriculum context is unknown.
 */
async function p5_nextNewTopic(studentId: string): Promise<NextAction | null> {
  // Fetch student curriculum context and already-attempted topic IDs in parallel
  const [user, attempted] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: { board: true, grade: true, subjects: true },
    }),
    prisma.studentTopicMastery.findMany({
      where: { studentId },
      select: { topicId: true },
    }),
  ]);

  const grade = user?.grade ? parseInt(String(user.grade), 10) : NaN;
  if (!user?.board || isNaN(grade)) return null; // cannot determine curriculum position

  const attemptedIds = attempted.map((a) => a.topicId);

  // Narrow to the student's enrolled subjects if specified
  const subjectNameFilter =
    Array.isArray(user.subjects) && (user.subjects as string[]).length > 0
      ? { name: { in: user.subjects as string[] } }
      : {};

  const nextTopic = await prisma.topicDef.findFirst({
    where: {
      lifecycle: 'active',
      // Exclude already-attempted topics
      ...(attemptedIds.length > 0 ? { id: { notIn: attemptedIds } } : {}),
      chapter: {
        lifecycle: 'active',
        subject: {
          lifecycle: 'active',
          ...subjectNameFilter,
          class: {
            lifecycle: 'active',
            grade,
            board: {
              lifecycle: 'active',
              slug: { equals: user.board, mode: 'insensitive' },
            },
          },
        },
      },
    },
    orderBy: [
      { chapter: { order: 'asc' } },
      { order: 'asc' },
    ],
    include: {
      chapter: {
        include: { subject: true },
      },
    },
  });

  if (!nextTopic) return null;

  return {
    topicId: nextTopic.id,
    subject: nextTopic.chapter.subject.name,
    chapter: nextTopic.chapter.name,
    ruleId: 'next_new_topic',
    reasonLabel: `Start ${nextTopic.chapter.subject.name} – ${nextTopic.chapter.name}`,
    actionType: 'notes',
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns the single most important next action for the student.
 * Short-circuits at the first matching priority — never runs all 5 queries.
 *
 * Returns null only if the student has no curriculum context (missing board/grade)
 * and has completed all reachable topics.
 */
export async function getNextAction(studentId: string): Promise<NextAction | null> {
  return (
    (await p1_resumeSession(studentId)) ??
    (await p2_dailyTask(studentId)) ??
    (await p3_attentionFlag(studentId)) ??
    (await p4_lowAccuracy(studentId)) ??
    (await p5_nextNewTopic(studentId))
  );
}
