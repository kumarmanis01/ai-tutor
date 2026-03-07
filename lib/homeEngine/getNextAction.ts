/**
 * FILE OBJECTIVE:
 * - Deterministic Home Tutor Engine.
 * - Returns a single, rule-prioritised next action for the student.
 * - ZERO AI calls. Prisma only. Target latency: <150 ms.
 *
 * Priority order (short-circuits at first match):
 *   LOCK – Active StructuredSession exists → must resume, never skip to P3–P5
 *   P1   – Resume unfinished LearningSession (legacy fallback)
 *   P2   – Pending DailyTask for today
 *   P3   – Unresolved AttentionFlag (lowest accuracy first)
 *   P4   – StudentTopicMastery with accuracy < 0.6 (lowest first)
 *   P5   – First unattempted TopicDef in the student's curriculum
 *
 * Session Lock (LOCK rule):
 *   If any StructuredSession exists with state NOT IN ('COMPLETE','EXPIRED'),
 *   the engine immediately returns a resume action for that session.
 *   P3–P5 are never evaluated while a live session exists, preventing the
 *   engine from recommending a new topic while the student is mid-session.
 *
 * DO NOT modify the existing recommendation engine.
 * DO NOT change the Prisma schema.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created deterministic tutor engine per architectural spec
 * - 2026-02-21 | claude | added topicName enrichment via shared enrichTopic helper
 * - 2026-03-07 | claude | added StructuredSession lock (LOCK rule) — prevents P3–P5
 *                          from firing while a live session exists; adds resumePhase
 *                          to NextAction so callers can deep-link to the correct phase
 * - 2026-03-07 | claude | Phase 1: replaced p5_nextNewTopic (simple first-unstarted
 *                          selection) with p5_scoredTopic (full TopicRanker scoring);
 *                          integrated rankTopics() from lib/recommendations/topicRanker;
 *                          added GetNextActionOptions with preloadedOrderedTopics to
 *                          avoid duplicate curriculum fetch when caller already has it;
 *                          removed ENABLE_TOPIC_RECOMMENDATION feature flag
 */

import { prisma } from '@/lib/prisma';
import { getOrderedTopicsForStudent, type OrderedTopic } from './getOrderedTopicsForStudent';
import { LOW_ACCURACY_THRESHOLD } from '../constants/mastery';
import { rankTopics, type ScoredTopic } from '@/lib/recommendations/topicRanker';
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
  masteryLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  accuracy?: number;
  /** Present only for resume_session — used to build /session/[id] URL */
  sessionId?: string;
  /**
   * Present only when the session lock fires (active StructuredSession found).
   * Tells the caller which phase the student was at so the UI can deep-link
   * directly to that step rather than always starting at OVERVIEW.
   */
  resumePhase?: 'OVERVIEW' | 'EXPLANATION' | 'PRACTICE' | 'TEST' | 'HOMEWORK';
  /** Present only for daily_task — estimated minutes for the task */
  estimatedTimeMin?: number;
}

/**
 * Options accepted by getNextAction.
 * All fields are optional — the engine degrades gracefully to independent
 * fetches when not provided.
 */
export interface GetNextActionOptions {
  /**
   * Pre-fetched ordered curriculum topics (from getOrderedTopicsForStudent).
   * When provided, the engine uses them directly for P3/P4 scoping and P5
   * scoring, eliminating a duplicate curriculum DB round-trip.
   * The dashboard server component passes this since it already fetches the
   * curriculum for the upcoming-topics list.
   */
  preloadedOrderedTopics?: OrderedTopic[];
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
 * Maps a StructuredSession phase to the ActionType the student should continue with.
 * OVERVIEW / EXPLANATION → the student is in the reading/learning stages → 'notes'
 * PRACTICE / TEST / HOMEWORK → the student is in an active exercise stage → 'practice'
 */
function structuredPhaseToAction(
  phase: 'OVERVIEW' | 'EXPLANATION' | 'PRACTICE' | 'TEST' | 'HOMEWORK',
): ActionType {
  if (phase === 'PRACTICE' || phase === 'TEST' || phase === 'HOMEWORK') return 'practice';
  return 'notes';
}

/**
 * SESSION LOCK — Check for any active StructuredSession.
 *
 * If a StructuredSession exists with state NOT IN ('COMPLETE', 'EXPIRED'),
 * the engine MUST return a resume action for that session. P3–P5 are never
 * evaluated while a live session is in flight.
 *
 * This prevents the engine from recommending a new topic while the student
 * is mid-session (e.g., paused at PRACTICE and returning to the dashboard).
 *
 * Uses a compound index: @@index([studentId, state]) — O(log n) lookup.
 */
async function lock_activeStructuredSession(studentId: string): Promise<NextAction | null> {
  const session = await prisma.structuredSession.findFirst({
    where: {
      studentId,
      state: { notIn: ['COMPLETE', 'EXPIRED'] },
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      topicId: true,
      state: true,
      topic: {
        select: {
          name: true,
          chapter: {
            select: {
              name: true,
              subject: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!session) return null;

  // State is one of OVERVIEW | EXPLANATION | PRACTICE | TEST | HOMEWORK at this point.
  // The notIn filter above already excluded COMPLETE and EXPIRED.
  const resumePhase = session.state as NextAction['resumePhase'];

  return {
    topicId: session.topicId,
    topicName: session.topic.name,
    subject: session.topic.chapter.subject.name,
    chapter: session.topic.chapter.name,
    ruleId: 'resume_session',
    reasonLabel: 'Continue your current session',
    actionType: structuredPhaseToAction(resumePhase!),
    sessionId: session.id,
    resumePhase,
  };
}

/**
 * P1 — Resume the most recently accessed incomplete LearningSession.
 * Pulls subject/chapter/topicId from the session's meta JSON.
 * LEGACY: only fires for students who pre-date the StructuredSession engine.
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
 * Scoped to the student's active curriculum: only topicIds in allowedTopicIds
 * are considered, preventing stale or cross-grade flags from surfacing.
 */
async function p3_attentionFlag(studentId: string, allowedTopicIds: Set<string>): Promise<NextAction | null> {
  if (allowedTopicIds.size === 0) return null;
  // Push the curriculum scope filter to the DB via IN clause — no in-memory fan-out.
  const flag = await prisma.attentionFlag.findFirst({
    where: { studentId, resolved: false, topicId: { in: [...allowedTopicIds] } },
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
 * P4 — StudentTopicMastery with accuracy below threshold, worst first.
 * Catches cases where AttentionFlags haven't been written yet.
 * Scoped to the student's active curriculum: only topicIds in allowedTopicIds
 * are considered, preventing stale or cross-grade mastery rows from surfacing.
 */
async function p4_lowAccuracy(studentId: string, allowedTopicIds: Set<string>): Promise<NextAction | null> {
  if (allowedTopicIds.size === 0) return null;
  // Push the curriculum scope filter to the DB via IN clause — no in-memory fan-out.
  const weak = await prisma.studentTopicMastery.findFirst({
    where: { studentId, accuracy: { lt: LOW_ACCURACY_THRESHOLD }, topicId: { in: [...allowedTopicIds] } },
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
 * P5 — Scored topic recommendation using TopicRanker signals.
 *
 * Replaces the old "first unattempted topic" selection with a full multi-signal
 * scoring pass over the curriculum frontier (first FRONTIER_SIZE topics after
 * the student's last mastered position).
 *
 * Signals applied (see lib/recommendations/topicRanker.ts for weights):
 *   weakTopicBoost       — student has struggled here
 *   curriculumNextBoost  — natural next topic in syllabus
 *   recencyPenalty       — studied < 24 h ago
 *   prerequisitePenalty  — prior topic not mastered
 *   weakSubjectBoost     — flagged weak subject
 *   momentumBoost        — scaled by engagement score
 *
 * @param studentId     - Student being recommended for.
 * @param orderedTopics - Already-fetched curriculum (from getOrderedTopicsForStudent).
 *                        Passed as preloaded to rankTopics to avoid a duplicate fetch.
 */
async function p5_scoredTopic(
  studentId: string,
  orderedTopics: OrderedTopic[],
): Promise<NextAction | null> {
  if (orderedTopics.length === 0) return null;

  const scored = await rankTopics(studentId, { preloadedOrderedTopics: orderedTopics });
  if (scored.length === 0) return null;

  const best = scored[0];

  return {
    topicId: best.topicId,
    topicName: best.topicName,
    subject: best.subjectName,
    chapter: best.chapterName,
    ruleId: 'next_new_topic',
    reasonLabel: p5ReasonLabel(best),
    actionType: p5ActionType(best),
  };
}

/**
 * Derive a human-readable reason label from the winning signals.
 * Used as the subtitle on the dashboard Start card.
 */
function p5ReasonLabel(topic: ScoredTopic): string {
  const s = topic.signals;
  if (s.weakTopicBoost) return `Build confidence in ${topic.topicName}`;
  if (s.curriculumNextBoost) return `Next up in your syllabus`;
  if (s.weakSubjectBoost) return `${topic.subjectName} needs your attention`;
  return `Continue with ${topic.topicName}`;
}

/**
 * Derive ActionType from winning signals.
 * First-time topics (curriculumNextBoost, no prior attempts) → 'notes'.
 * Topics the student has already started → 'practice'.
 */
function p5ActionType(topic: ScoredTopic): ActionType {
  if (topic.signals.weakTopicBoost) return 'practice';
  if (topic.signals.curriculumNextBoost) return 'notes';
  return 'practice';
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

/**
 * Returns the single most important next action for the student.
 * Short-circuits at the first matching priority — never runs all rules.
 *
 * @param studentId - The student to recommend for.
 * @param options   - Optional preloaded data to avoid duplicate DB round-trips.
 *
 * Returns a `{ action, traceId }` object in development, or the `NextAction`
 * directly in production (for API response size reasons).
 */
export async function getNextAction(
  studentId: string,
  options: GetNextActionOptions = {},
): Promise<GetNextActionReturn> {
  const traceId = randomUUID();

  // ── SESSION LOCK ─────────────────────────────────────────────────────────────
  // Check for any active StructuredSession BEFORE evaluating P1–P5.
  // If one exists, the student must resume it — the engine never jumps to P3–P5
  // (weak topics, new recommendations) while a live session is in flight.
  // This is the primary resume path for all students using the new session engine.
  const sessionLock = await lock_activeStructuredSession(studentId);
  if (sessionLock) {
    // Active session found — return resume action immediately.
    // P1 (legacy LearningSession), P2 (DailyTask), P3–P5 are all skipped.
    return finalise(sessionLock, traceId, studentId);
  }

  // ── LEGACY P1 + P2 ───────────────────────────────────────────────────────────
  // No active StructuredSession. Check legacy LearningSession (P1) and DailyTask
  // (P2). These only fire for students who pre-date the StructuredSession engine.
  const p1OrP2 = (await p1_resumeSession(studentId)) ?? (await p2_dailyTask(studentId));

  let action: NextAction | null;
  if (p1OrP2) {
    action = p1OrP2;
  } else {
    // ── CURRICULUM RULES P3–P5 ─────────────────────────────────────────────────
    // Guaranteed: no active session exists (lock was null, P1 was null).
    // Safe to recommend a new/revision topic.
    //
    // Use preloaded topics when available (dashboard passes them to avoid a
    // duplicate curriculum fetch). Fall back to a fresh query otherwise.
    const orderedTopics =
      options.preloadedOrderedTopics ?? (await getOrderedTopicsForStudent(studentId));
    const allowedTopicIds = new Set(orderedTopics.map((t) => t.id));

    action =
      (await p3_attentionFlag(studentId, allowedTopicIds as Set<string>)) ??
      (await p4_lowAccuracy(studentId, allowedTopicIds as Set<string>)) ??
      (await p5_scoredTopic(studentId, orderedTopics)) ??
      null;
  }

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

  return finalise(action, traceId, studentId);
}

// ─── Finalise helper ──────────────────────────────────────────────────────────

/**
 * Shared tail for every exit path in getNextAction.
 * Handles logging, loop detection, and dev-mode trace wrapping.
 * Extracted so the session lock fast-path can reuse it without duplication.
 */
function finalise(
  action: NextAction,
  traceId: string,
  studentId: string,
): GetNextActionReturn {
  // Log decision for observability (no PII beyond studentId).
  try {
    logger.info('engine.decision', {
      traceId,
      studentId,
      ruleId: action.ruleId,
      actionType: action.actionType,
      topicId: action.topicId ?? null,
      reasonLabel: action.reasonLabel,
      resumePhase: action.resumePhase ?? null,
    });
  } catch (err) {
    logger.warn('engine.decision.log_failed', { traceId, studentId, error: String(err) });
  }

  // Loop detection: warn if the same (ruleId, topicId) repeats consecutively.
  try {
    const key = `${action.ruleId}:${action.topicId ?? 'null'}`;
    const arr = recentDecisions.get(studentId) ?? [];
    arr.push(key);
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
    logger.warn('engine.loop_detection_failed', { traceId, studentId, error: String(err) });
  }

  if (process.env.NODE_ENV !== 'production') {
    return { action, traceId };
  }

  return action;
}
