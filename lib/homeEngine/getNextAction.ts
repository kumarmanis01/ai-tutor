/**
 * FILE OBJECTIVE:
 * - Deterministic Home Tutor Engine.
 * - Returns a single, rule-prioritised next action for the student.
 * - ZERO AI calls. Prisma only. Target latency: <150 ms.
 *
 * Priority order (short-circuits at first match):
 *   P0   – Homework pending/overdue with dueDate <= NOW + 48h (hard block)
 *   P1   – Resume active StructuredSession or LearningSession (legacy)
 *   P2   – Weak topic: StudentTopicProgress mastery < 0.4 AND practiceCount > 5
 *   P3   – Spaced revision: mastery 0.4–0.85, not studied in 7+ days
 *   P4   – Inactive return: no study activity in 3+ days
 *   P5   – Scored next topic via TopicRanker
 *   P6   – All topics complete
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
 * - 2026-03-07 | claude | Phase 2: merged LOCK rule into P1 (StructuredSession-first
 *                          with LearningSession legacy fallback); exported SessionPhase
 *                          type; P1 now fully owns session resume for both engines;
 *                          TopicRanker incomplete-session detection confirmed removed
 * - 2026-03-07 | claude | Phase 3: added P0 homework_pending blocker (HomeworkAssignment
 *                          PENDING/OVERDUE within 48h); replaced P2 daily_task with
 *                          p2_weakTopicUrgent (StudentTopicProgress mastery<0.4 & count>5);
 *                          replaced P3 attention_flag with p3_spacedRevision (7-day window);
 *                          replaced P4 low_accuracy with p4_inactiveReturn (3-day inactivity);
 *                          added 'homework' ActionType and assignmentId to NextAction;
 *                          added new RuleIds: homework_pending, weak_topic_urgent,
 *                          spaced_revision, inactive_return
 */

import { prisma } from '@/lib/prisma';
import { getOrderedTopicsForStudent, type OrderedTopic } from './getOrderedTopicsForStudent';
import { rankTopics, type ScoredTopic } from '@/lib/recommendations/topicRanker';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';

// In-memory recent decision store used to detect possible engine loops in dev.
// Maps studentId -> array of serialized decisions (`ruleId:topicId`), capped at 5.
const recentDecisions: Map<string, string[]> = new Map();
const RECENT_DECISIONS_CAP = 5;

// ─── Public types ────────────────────────────────────────────────────────────

export type ActionType = 'notes' | 'practice' | 'revision' | 'homework';

export type RuleId =
  | 'homework_pending'
  | 'resume_session'
  | 'weak_topic_urgent'
  | 'spaced_revision'
  | 'inactive_return'
  | 'next_new_topic'
  | 'all_topics_complete'
  // Legacy ruleIds kept for API backward-compatibility — no longer emitted.
  | 'daily_task'
  | 'low_mastery'
  | 'low_accuracy';

/**
 * The active phase of a StructuredSession.
 * Maps directly to the SessionPhase enum values in the Prisma schema.
 * Used in NextAction.resumePhase so callers can deep-link to the exact step.
 */
export type SessionPhase = 'OVERVIEW' | 'EXPLANATION' | 'PRACTICE' | 'TEST' | 'HOMEWORK';

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
   * Present only when P1 resumes a StructuredSession (not a legacy LearningSession).
   * Tells the caller which phase the student was at so the UI can deep-link
   * directly to that step rather than always starting at OVERVIEW.
   * Absent for legacy LearningSession resumes — those lack a structured phase.
   */
  resumePhase?: SessionPhase;
  /** Present only for daily_task — estimated minutes for the task */
  estimatedTimeMin?: number;
  /** Present only for homework_pending — the HomeworkAssignment id to open */
  assignmentId?: string;
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
  /**
   * When true, the return value includes a trace object (rulesEvaluated,
   * matchedRule, finalDecision, latencyMs) for admin observability.
   * Used by GET /api/admin/recommendation-trace.
   */
  returnTrace?: boolean;
}

/**
 * Trace output for next-action engine observability.
 * Populated when options.returnTrace is true.
 */
export interface NextActionTrace {
  /** Rule names evaluated in order (short-circuit: stops at first match). */
  rulesEvaluated: string[];
  /** The rule that produced the returned action. */
  matchedRule: string;
  /** Same as matchedRule; alias for compatibility. */
  finalDecision: string;
  /** Time taken for getNextAction in ms. */
  latencyMs?: number;
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
 * P0 — Homework blocker (hard gate before all other rules).
 *
 * Fires when the student has a PENDING or OVERDUE HomeworkAssignment
 * due within the next 48 hours. Short-circuits P1–P6 so the student
 * cannot be recommended a new topic while homework is outstanding.
 *
 * Query: HomeworkAssignment WHERE studentId = X
 *   AND status IN ('PENDING','OVERDUE')
 *   AND dueDate <= NOW() + 48h
 * ORDER BY dueDate ASC — most urgent first.
 */
async function p0_homeworkBlocker(studentId: string): Promise<NextAction | null> {
  const cutoff = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const hw = await prisma.homeworkAssignment.findFirst({
    where: {
      studentId,
      status: { in: ['PENDING', 'OVERDUE'] },
      dueDate: { lte: cutoff },
    },
    orderBy: { dueDate: 'asc' },
    select: {
      id: true,
      topicId: true,
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

  if (!hw) return null;

  return {
    topicId: hw.topicId,
    topicName: hw.topic.name,
    subject: hw.topic.chapter.subject.name,
    chapter: hw.topic.chapter.name,
    ruleId: 'homework_pending',
    reasonLabel: 'Complete your pending homework',
    actionType: 'homework',
    assignmentId: hw.id,
  };
}

/**
 * Maps a StructuredSession phase to the ActionType the student should continue with.
 * OVERVIEW / EXPLANATION → the student is in the reading/learning stages → 'notes'
 * PRACTICE / TEST / HOMEWORK → the student is in an active exercise stage → 'practice'
 */
function structuredPhaseToAction(phase: SessionPhase): ActionType {
  if (phase === 'PRACTICE' || phase === 'TEST' || phase === 'HOMEWORK') return 'practice';
  return 'notes';
}

/**
 * P1 — Resume the most recently active session.
 *
 * Priority within P1:
 *   1a. StructuredSession (new engine) — checked first.
 *       Excludes COMPLETE and EXPIRED states.
 *       Returns resumePhase so callers can deep-link to the exact phase
 *       (OVERVIEW → EXPLANATION → PRACTICE → TEST → HOMEWORK).
 *   1b. LearningSession (legacy) — fallback for students on the old engine.
 *       Only evaluated when no active StructuredSession exists.
 *       Does NOT return resumePhase — legacy sessions have no structured phases.
 *
 * Short-circuits the engine: when P1 finds a session, P2–P5 are never evaluated.
 * This prevents recommending a new topic while the student is mid-session.
 *
 * Uses a compound index on StructuredSession: @@index([studentId, state]) — O(log n).
 */
async function p1_resumeSession(studentId: string): Promise<NextAction | null> {
  // ── 1a. StructuredSession — primary path for new-engine students ──────────
  const structured = await prisma.structuredSession.findFirst({
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

  if (structured) {
    // state is guaranteed to be one of the SessionPhase values — COMPLETE and EXPIRED
    // are excluded by the notIn filter above.
    const resumePhase = structured.state as SessionPhase;
    return {
      topicId: structured.topicId,
      topicName: structured.topic.name,
      subject: structured.topic.chapter.subject.name,
      chapter: structured.topic.chapter.name,
      ruleId: 'resume_session',
      reasonLabel: 'Continue your current session',
      actionType: structuredPhaseToAction(resumePhase),
      sessionId: structured.id,
      resumePhase,
    };
  }

  // ── 1b. LearningSession — legacy fallback for pre-StructuredSession students ─
  // Only runs when no active StructuredSession was found above.
  const legacy = await prisma.learningSession.findFirst({
    where: { studentId, isCompleted: false },
    orderBy: { lastAccessed: 'desc' },
    select: {
      id: true,
      activityType: true,
      activityRef: true,
      meta: true,
    },
  });
  if (!legacy) return null;

  const meta = safeObj(legacy.meta);
  const topicId = strOrNull(legacy.activityRef) ?? strOrNull(meta.topicId) ?? null;
  // Defensive: skip sessions without topicId
  if (!topicId) return null;
  // Defensive: only allow lesson/practice activityType
  const allowedTypes = ['lesson', 'practice'];
  if (!allowedTypes.includes(legacy.activityType)) return null;

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
    actionType: sessionToAction(legacy.activityType),
    sessionId: legacy.id,
    // No resumePhase for legacy sessions — they pre-date structured phases.
  };
}

/**
 * P2 — Weak topic (urgent).
 *
 * Fires when the student has practiced a topic meaningfully (practiceCount > 5)
 * but mastery remains critically low (< 0.4). Uses StudentTopicProgress as the
 * canonical source — same thresholds as getWeakTopics().
 * Scoped to the student's active curriculum (allowedTopicIds).
 */
async function p2_weakTopicUrgent(studentId: string, allowedTopicIds: Set<string>): Promise<NextAction | null> {
  if (allowedTopicIds.size === 0) return null;

  const weak = await prisma.studentTopicProgress.findFirst({
    where: {
      studentId,
      mastery: { lt: 0.4 },
      practiceCount: { gt: 5 },
      topicId: { in: [...allowedTopicIds] },
    },
    orderBy: { mastery: 'asc' }, // worst mastery first
    select: { topicId: true, mastery: true },
  });
  if (!weak) return null;

  const enriched = await enrichTopic(weak.topicId, { topicName: null, subject: null, chapter: null });
  return {
    topicId: weak.topicId,
    topicName: enriched.topicName,
    subject: enriched.subject,
    chapter: enriched.chapter,
    ruleId: 'weak_topic_urgent',
    reasonLabel: `Strengthen your understanding of ${enriched.topicName ?? 'this topic'}`,
    actionType: 'practice',
    accuracy: weak.mastery,
  };
}

/**
 * P3 — Spaced revision.
 *
 * Fires when a partially-mastered topic (mastery 0.4–0.85) has not been
 * studied in 7+ days. Surfaces the most overdue topic first (oldest
 * lastStudiedAt) to enforce spaced-repetition intervals.
 * Scoped to the student's active curriculum (allowedTopicIds).
 */
async function p3_spacedRevision(studentId: string, allowedTopicIds: Set<string>): Promise<NextAction | null> {
  if (allowedTopicIds.size === 0) return null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const due = await prisma.studentTopicProgress.findFirst({
    where: {
      studentId,
      mastery: { gte: 0.4, lt: 0.85 },
      lastStudiedAt: { lt: sevenDaysAgo },
      topicId: { in: [...allowedTopicIds] },
    },
    orderBy: { lastStudiedAt: 'asc' }, // most overdue first
    select: { topicId: true, mastery: true },
  });
  if (!due) return null;

  const enriched = await enrichTopic(due.topicId, { topicName: null, subject: null, chapter: null });
  return {
    topicId: due.topicId,
    topicName: enriched.topicName,
    subject: enriched.subject,
    chapter: enriched.chapter,
    ruleId: 'spaced_revision',
    reasonLabel: `Time to revisit ${enriched.topicName ?? 'this topic'}`,
    actionType: 'revision',
    accuracy: due.mastery,
  };
}

/**
 * P4 — Inactive return.
 *
 * Fires when the student has had no study activity (within their curriculum)
 * for 3+ consecutive days. Returns them to the topic they last studied,
 * giving a "welcome back" prompt before recommending something brand-new.
 * Scoped to the student's active curriculum (allowedTopicIds).
 */
async function p4_inactiveReturn(studentId: string, allowedTopicIds: Set<string>): Promise<NextAction | null> {
  if (allowedTopicIds.size === 0) return null;

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  // Find the most-recently studied allowed topic
  const lastStudied = await prisma.studentTopicProgress.findFirst({
    where: { studentId, topicId: { in: [...allowedTopicIds] } },
    orderBy: { lastStudiedAt: 'desc' },
    select: { topicId: true, mastery: true, lastStudiedAt: true },
  });

  // Student is active (studied within 3 days) or has no history → skip
  if (!lastStudied || lastStudied.lastStudiedAt >= threeDaysAgo) return null;

  const enriched = await enrichTopic(lastStudied.topicId, { topicName: null, subject: null, chapter: null });
  return {
    topicId: lastStudied.topicId,
    topicName: enriched.topicName,
    subject: enriched.subject,
    chapter: enriched.chapter,
    ruleId: 'inactive_return',
    reasonLabel: `Welcome back! Let's pick up where you left off`,
    actionType: 'notes',
    accuracy: lastStudied.mastery,
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
export type GetNextActionReturn =
  | NextAction
  | null
  | { action: NextAction | null; traceId: string; trace?: NextActionTrace };

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
  const startMs = Date.now();
  const trace: NextActionTrace = {
    rulesEvaluated: [],
    matchedRule: '',
    finalDecision: '',
  };
  const returnTrace = options.returnTrace === true;

  // ── P0 — Homework blocker (hard gate) ────────────────────────────────────────
  // Fires before any other rule. A PENDING/OVERDUE assignment due within 48 h
  // takes absolute priority — the student must complete it first.
  trace.rulesEvaluated.push('P0');
  const p0 = await p0_homeworkBlocker(studentId);
  if (p0) {
    trace.matchedRule = 'homework_pending';
    trace.finalDecision = 'homework_pending';
    return finalise(p0, traceId, studentId, { trace, returnTrace, startMs });
  }

  // ── P1 — Resume session ───────────────────────────────────────────────────────
  // Checks StructuredSession first (new engine), then LearningSession (legacy).
  // When P1 fires, P2–P5 are never evaluated — the student must finish the
  // in-progress session before the engine recommends a new topic.
  trace.rulesEvaluated.push('P1');
  const p1 = await p1_resumeSession(studentId);
  if (p1) {
    trace.matchedRule = 'resume_session';
    trace.finalDecision = 'resume_session';
    return finalise(p1, traceId, studentId, { trace, returnTrace, startMs });
  }

  // ── CURRICULUM RULES P2–P5 ─────────────────────────────────────────────────
  // Guaranteed: no blocking homework (P0) and no active session (P1).
  // Safe to recommend a new or revision topic.
  //
  // Use preloaded topics when available (dashboard passes them to avoid a
  // duplicate curriculum fetch). Fall back to a fresh query otherwise.
  const orderedTopics =
    options.preloadedOrderedTopics ?? (await getOrderedTopicsForStudent(studentId));
  const allowedTopicIds = new Set(orderedTopics.map((t) => t.id));

  let action: NextAction | null;

  // P2 — Weak topic (mastery < 0.4 AND practiceCount > 5)
  trace.rulesEvaluated.push('P2');
  action = await p2_weakTopicUrgent(studentId, allowedTopicIds as Set<string>);
  if (action) {
    trace.matchedRule = action.ruleId;
    trace.finalDecision = action.ruleId;
    return finalise(action, traceId, studentId, { trace, returnTrace, startMs });
  }

  // P3 — Spaced revision (mastery 0.4–0.85, not studied in 7+ days)
  trace.rulesEvaluated.push('P3');
  action = await p3_spacedRevision(studentId, allowedTopicIds as Set<string>);
  if (action) {
    trace.matchedRule = action.ruleId;
    trace.finalDecision = action.ruleId;
    return finalise(action, traceId, studentId, { trace, returnTrace, startMs });
  }

  // P4 — Inactive return (no study activity in 3+ days)
  trace.rulesEvaluated.push('P4');
  action = await p4_inactiveReturn(studentId, allowedTopicIds as Set<string>);
  if (action) {
    trace.matchedRule = action.ruleId;
    trace.finalDecision = action.ruleId;
    return finalise(action, traceId, studentId, { trace, returnTrace, startMs });
  }

  // P5 — Scored next topic via TopicRanker
  trace.rulesEvaluated.push('P5');
  action = (await p5_scoredTopic(studentId, orderedTopics)) ?? null;

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
  trace.matchedRule = action.ruleId;
  trace.finalDecision = action.ruleId;

  return finalise(action, traceId, studentId, {
    trace,
    returnTrace,
    startMs,
  });
}

// ─── Finalise helper ──────────────────────────────────────────────────────────

interface FinaliseOptions {
  trace?: NextActionTrace;
  returnTrace?: boolean;
  startMs?: number;
}

/**
 * Shared tail for every exit path in getNextAction.
 * Handles logging, loop detection, and dev-mode trace wrapping.
 * Extracted so the session lock fast-path can reuse it without duplication.
 */
function finalise(
  action: NextAction,
  traceId: string,
  studentId: string,
  opts?: FinaliseOptions,
): GetNextActionReturn {
  if (opts?.trace && opts.startMs !== undefined) {
    opts.trace.latencyMs = Date.now() - opts.startMs;
  }

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

  if (opts?.returnTrace && opts.trace) {
    return { action, traceId, trace: opts.trace };
  }
  if (process.env.NODE_ENV !== 'production') {
    return { action, traceId };
  }

  return action;
}
