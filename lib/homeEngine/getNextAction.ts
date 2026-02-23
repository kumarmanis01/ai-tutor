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
 * - 2026-02-21 | claude | added topicName enrichment via shared enrichTopic helper
 */

import { prisma } from '@/lib/prisma';
import type { MasteryLevel } from '@prisma/client';
import { getOrderedTopicsForStudent } from './getOrderedTopicsForStudent';
import { LOW_ACCURACY_THRESHOLD } from '../constants/mastery';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';

// In-memory recent decision store used to detect possible engine loops in dev.
// Maps studentId -> array of serialized decisions (`ruleId:topicId`), capped at 5.
const recentDecisions: Map<string, string[]> = new Map();
const RECENT_DECISIONS_CAP = 5;

// ─── Public types ────────────────────────────────────────────────────────────

export type ActionType = 'notes' | 'practice' | 'revision';

export type RuleId =
  | 'resume_session'
  | 'daily_task'
  | 'low_mastery'
  | 'low_accuracy'
  | 'next_new_topic'
  | 'all_topics_complete';

export interface NextAction {
  topicId: string | null;
  /** Canonical topic name from TopicDef. Null if topic not found in curriculum. */
  topicName: string | null;
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

// ─── Enrichment helper ────────────────────────────────────────────────────────

interface TopicEnrichment {
  topicName: string | null;
  subject: string | null;
  chapter: string | null;
}

/**
 * Single-query enrichment: fetches TopicDef with chapter→subject join.
 * Returns canonical names from the curriculum. Falls back to the provided
 * defaults when the topicId is absent or the record is not found.
 */
async function enrichTopic(
  topicId: string | null,
  fallback: TopicEnrichment
): Promise<TopicEnrichment> {
  if (!topicId) return { topicName: null, ...fallback };

  const topic = await prisma.topicDef.findUnique({
    where: { id: topicId },
    include: {
      chapter: {
        include: { subject: true },
      },
    },
  });

  if (!topic) return { topicName: null, ...fallback };

  return {
    topicName: topic.name,
    chapter: topic.chapter.name,
    subject: topic.chapter.subject.name,
  };
}

// ─── Priority sub-functions ───────────────────────────────────────────────────

/**
 * P1 — Resume the most recently accessed incomplete LearningSession.
 * Pulls subject/chapter/topicId from the session's meta JSON.
 */
async function p1_resumeSession(studentId: string): Promise<NextAction | null> {
  // Only consider sessions with topicId present and valid activityType
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
  const topicId = strOrNull(session.activityRef) ?? strOrNull(meta.topicId) ?? null;
  // Defensive: skip sessions without topicId
  if (!topicId) return null;
  // Defensive: only allow lesson/practice activityType
  const allowedTypes = ['lesson', 'practice'];
  if (!allowedTypes.includes(session.activityType)) return null;
  const enriched = await enrichTopic(topicId, {
    topicName: null,
    subject: strOrNull(meta.subject) ?? strOrNull(meta.subjectName) ?? null,
    chapter: strOrNull(meta.chapter) ?? strOrNull(meta.chapterName) ?? null,
  });
  return {
    topicId,
    topicName: enriched.topicName,
    subject: enriched.subject,
    chapter: enriched.chapter,
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

  const enriched = await enrichTopic(task.topicId ?? null, {
    topicName: null,
    subject: task.subject ?? null,
    chapter: task.chapter ?? null,
  });
  return {
    topicId: task.topicId ?? null,
    topicName: enriched.topicName,
    subject: enriched.subject,
    chapter: enriched.chapter,
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
  // Enforce curriculum scope: only consider flags for topics in student's curriculum
  const orderedTopics = await getOrderedTopicsForStudent(studentId);
  if (!orderedTopics.length) return null;
  const allowedTopicIds = new Set(orderedTopics.map(t => t.id));
  // Find all unresolved flags, filter in-memory to allowed topics, then pick lowest accuracy
  const flags = await prisma.attentionFlag.findMany({
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
  const flag = flags.find(f => f.topicId && allowedTopicIds.has(f.topicId));
  if (!flag) return null;

  const enriched = await enrichTopic(flag.topicId, {
    topicName: null,
    subject: flag.subject,
    chapter: flag.chapter,
  });
  return {
    topicId: flag.topicId,
    topicName: enriched.topicName,
    subject: enriched.subject,
    chapter: enriched.chapter,
    ruleId: 'low_mastery',
    reasonLabel: `Revise ${enriched.subject ?? flag.subject} – ${enriched.chapter ?? flag.chapter}`,
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
  // Enforce curriculum scope: only consider mastery for topics in student's curriculum
  const orderedTopics = await getOrderedTopicsForStudent(studentId);
  if (!orderedTopics.length) return null;
  const allowedTopicIds = new Set(orderedTopics.map(t => t.id));
  // Use centralized threshold
  const weaks = await prisma.studentTopicMastery.findMany({
    where: { studentId, accuracy: { lt: LOW_ACCURACY_THRESHOLD } },
    orderBy: { accuracy: 'asc' },
    select: {
      topicId: true,
      subject: true,
      chapter: true,
      masteryLevel: true,
      accuracy: true,
    },
  });
  const weak = weaks.find(w => w.topicId && allowedTopicIds.has(w.topicId));
  if (!weak) return null;

  const enriched = await enrichTopic(weak.topicId, {
    topicName: null,
    subject: weak.subject,
    chapter: weak.chapter,
  });
  return {
    topicId: weak.topicId,
    topicName: enriched.topicName,
    subject: enriched.subject,
    chapter: enriched.chapter,
    ruleId: 'low_accuracy',
    reasonLabel: `Practice ${enriched.subject ?? weak.subject} – ${enriched.chapter ?? weak.chapter}`,
    actionType: 'practice',
    masteryLevel: weak.masteryLevel,
    accuracy: weak.accuracy,
  };
}

/**
 * P5 — First unattempted TopicDef in the student's curriculum.
 * Delegates the curriculum query to getOrderedTopicsForStudent — the shared
 * function that applies identical board + grade + subject + lifecycle filters.
 * Returns null if curriculum context is unknown or all topics are attempted.
 */
async function p5_nextNewTopic(studentId: string): Promise<NextAction | null> {
  // Run the curriculum fetch and the attempted-IDs fetch in parallel.
  const [orderedTopics, attempted] = await Promise.all([
    getOrderedTopicsForStudent(studentId),
    prisma.studentTopicMastery.findMany({
      where: { studentId },
      select: { topicId: true },
    }),
  ]);

  // getOrderedTopicsForStudent returns [] when board/grade is missing.
  if (orderedTopics.length === 0) return null;

  const attemptedIds = new Set(attempted.map((a) => a.topicId));
  const nextTopic = orderedTopics.find((t) => !attemptedIds.has(t.id));
  if (!nextTopic) return null;

  return {
    topicId: nextTopic.id,
    topicName: nextTopic.name,
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
export type GetNextActionReturn = NextAction | null | { action: NextAction | null; traceId: string };

export async function getNextAction(studentId: string): Promise<GetNextActionReturn> {
  const traceId = randomUUID();

  // Evaluate priorities in order — preserve short-circuiting behaviour.
  let action =
    (await p1_resumeSession(studentId)) ??
    (await p2_dailyTask(studentId)) ??
    (await p3_attentionFlag(studentId)) ??
    (await p4_lowAccuracy(studentId)) ??
    (await p5_nextNewTopic(studentId)) ??
    null;

  // Fallback: if the student has a curriculum but all topics are attempted,
  // return a stable revision action so the UI can render a friendly CTA.
  // This replaces a raw `null` so callers always get an actionable suggestion.
  if (!action) {
    action = {
      topicId: null,
      topicName: null,
      subject: null,
      chapter: null,
      ruleId: 'all_topics_complete',
      reasonLabel: 'All topics completed — try a revision test',
      actionType: 'revision',
      estimatedTimeMin: 20,
    };
  }

  // Log decision for observability (no PII beyond studentId).
  try {
    logger.info('engine.decision', {
      traceId,
      studentId,
      ruleId: action?.ruleId ?? null,
      actionType: action?.actionType ?? null,
      topicId: action?.topicId ?? null,
      reasonLabel: action?.reasonLabel ?? null,
    });
  } catch (err) {
    // Swallow logging errors — engine result should not fail on logger problems.
  }

  // Loop detection: track recent decisions per student and warn if the same
  // (ruleId, topicId) repeats RECENT_DECISIONS_CAP times consecutively.
  try {
    const key = `${action?.ruleId ?? 'null'}:${action?.topicId ?? 'null'}`;
    const arr = recentDecisions.get(studentId) ?? [];
    arr.push(key);
    // keep only the last RECENT_DECISIONS_CAP entries
    if (arr.length > RECENT_DECISIONS_CAP) arr.splice(0, arr.length - RECENT_DECISIONS_CAP);
    recentDecisions.set(studentId, arr);

    if (arr.length === RECENT_DECISIONS_CAP) {
      const allSame = arr.every((v) => v === arr[0]);
      if (allSame && arr[0] !== 'null:null') {
        const [ruleId, topicId] = arr[0].split(':');
        logger.warn('engine.loop.detected', { studentId, ruleId, topicId });
      }
    }
  } catch (err) {
    // ignore loop-detection failures
  }

  if (process.env.NODE_ENV !== 'production') {
    return { action, traceId };
  }

  return action;
}
