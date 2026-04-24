
/**
 * FILE OBJECTIVE:
 * - Deterministic Home Tutor Engine. Returns a single, rule-prioritised next action for the student. ZERO AI calls. Prisma only. Target latency: <150 ms.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/homeEngine/getNextAction.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-23T00:00:00Z | copilot | strict-mode: add local row types, annotate callbacks, file header
 * - 2026-02-21 | claude | created deterministic tutor engine per architectural spec
 * - 2026-02-21 | claude | added topicName enrichment via shared enrichTopic helper
 * - 2026-03-07 | claude | added StructuredSession lock (LOCK rule) -- prevents P3-P5
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
 * - 2026-03-07 | claude | Phase 4: replaced fixed 7-day spaced revision window with
 *                          dynamic SPACED_REVISION_INTERVALS (3/7/14/30 days per band);
 *                          P2+P3+P4 now share a single StudentTopicProgress findMany
 *                          (ProgressRow[]) -- eliminates 2 extra DB queries; p3 selects
 *                          the most overdue topic (largest overdueDays); reasonLabel
 *                          now includes "it's been N days" for actionable context
 * - 2026-03-08 | claude | Phase 6: RecommendationTrace observability -- per-rule durationMs
 *                          timing, topicScoringBreakdown from P5 ScoredTopics; fire-and-
 *                          forget Redis write gated by ENABLE_REC_TRACE=1; p5_scoredTopic
 *                          now returns { action, scoredTopics } so trace can capture the
 *                          full ranked-topic signal table without an extra DB call
 */

import { prisma } from '@/lib/prisma';
import { getOrderedTopicsForStudent, type OrderedTopic } from './getOrderedTopicsForStudent';
import { SPACED_REVISION_INTERVALS } from '../constants/mastery';
import { rankTopics, type ScoredTopic } from '@/lib/recommendations/topicRanker';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import {
  isRecTraceEnabled,
  persistRecTrace,
  TRACE_SAMPLE_RATE,
  type RecommendationTrace,
  type RuleEntry,
} from './recommendationTrace';

/**
 * Canonical ordered sequence of every rule ruleId in the P0→P6 ladder.
 * Used by finalise() to pad un-evaluated rules with { evaluated: false }
 * so the full ladder is always visible in a RecommendationTrace, making
 * short-circuit behaviour explicit rather than implicit.
 */
const ALL_RULE_IDS: string[] = [
  'homework_pending',   // P0
  'resume_session',     // P1
  'weak_topic_urgent',  // P2
  'spaced_revision',    // P3
  'inactive_return',    // P4
  'next_new_topic',     // P5
  'all_topics_complete',// P6 fallback
];

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
  // Legacy ruleIds kept for API backward-compatibility -- no longer emitted.
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
  /** Present only for resume_session -- used to build /session/[id] URL */
  sessionId?: string;
  /**
   * Present only when P1 resumes a StructuredSession (not a legacy LearningSession).
   * Tells the caller which phase the student was at so the UI can deep-link
   * directly to that step rather than always starting at OVERVIEW.
   * Absent for legacy LearningSession resumes -- those lack a structured phase.
   */
  resumePhase?: SessionPhase;
  /** Present only for daily_task -- estimated minutes for the task */
  estimatedTimeMin?: number;
  /** Present only for homework_pending -- the HomeworkAssignment id to open */
  assignmentId?: string;
}

/**
 * Options accepted by getNextAction.
 * All fields are optional -- the engine degrades gracefully to independent
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
  if (!topicId) return { ...fallback, topicName: null };


  // Local row type for topicDef with chapter/subject join
  type TopicDefRow = {
    name: string;
    chapter: { name: string; subject: { name: string } };
  } | null;
  const topic = await prisma.topicDef.findUnique({
    where: { id: topicId },
    include: {
      chapter: {
        include: { subject: true },
      },
    },
  }) as TopicDefRow;

  if (!topic) return { ...fallback, topicName: null };

  return { ...fallback, topicName: topic.name, chapter: topic.chapter.name, subject: topic.chapter.subject.name };
}

// ─── Shared progress row type (P2 / P3 / P4) ─────────────────────────────────

/**
 * A single row fetched from StudentTopicProgress for curriculum rules P2-P4.
 * One findMany per getNextAction call supplies all three rules; no per-rule queries.
 */
interface ProgressRow {
  topicId: string;
  mastery: number;
  practiceCount: number;
  lastStudiedAt: Date;
}

/**
 * Returns the spaced-repetition interval in days for a given mastery score.
 * Bands are [min, max) -- the last band implicitly covers mastery = 1.0.
 * Returns null when mastery < 0.40 (those topics are owned by P2, not P3).
 */
function lookupSpacedInterval(mastery: number): number | null {
  for (const band of SPACED_REVISION_INTERVALS) {
    if (mastery >= band.min && mastery < band.max) return band.intervalDays;
  }
  // mastery exactly 1.0 -- use the highest band (30 days)
  const last = SPACED_REVISION_INTERVALS[SPACED_REVISION_INTERVALS.length - 1];
  if (mastery >= last.min) return last.intervalDays;
  return null; // mastery < 0.40 → P2 domain
}

/**
 * Returns the number of elapsed whole calendar days between two Unix timestamps,
 * normalized to UTC midnight. Prevents a topic studied at 23:50 from counting as
 * "1 day ago" just 10 minutes later -- spaced repetition intervals advance at day
 * boundaries, not at the exact millisecond the student last studied.
 */
function floorDays(ms: number): number {
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// ─── Priority sub-functions ───────────────────────────────────────────────────

/**
 * P0 -- Homework blocker (hard gate before all other rules).
 *
 * Fires when the student has a PENDING or OVERDUE HomeworkAssignment
 * due within the next 48 hours. Short-circuits P1-P6 so the student
 * cannot be recommended a new topic while homework is outstanding.
 *
 * Query: HomeworkAssignment WHERE studentId = X
 *   AND status IN ('PENDING','OVERDUE')
 *   AND dueDate <= NOW() + 48h
 * ORDER BY dueDate ASC -- most urgent first.
 */
async function p0_homeworkBlocker(studentId: string): Promise<NextAction | null> {
  const cutoff = new Date(Date.now() + 48 * 60 * 60 * 1000);


  // Local row type for homeworkAssignment
  type HomeworkAssignmentRow = {
    id: string;
    topicId: string;
    topic: { name: string; chapter: { name: string; subject: { name: string } } };
  } | null;
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
  }) as HomeworkAssignmentRow;

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
 * P1 -- Resume the most recently active session.
 *
 * Priority within P1:
 *   1a. StructuredSession (new engine) -- checked first.
 *       Excludes COMPLETE and EXPIRED states.
 *       Returns resumePhase so callers can deep-link to the exact phase
 *       (OVERVIEW → EXPLANATION → PRACTICE → TEST → HOMEWORK).
 *   1b. LearningSession (legacy) -- fallback for students on the old engine.
 *       Only evaluated when no active StructuredSession exists.
 *       Does NOT return resumePhase -- legacy sessions have no structured phases.
 *
 * Short-circuits the engine: when P1 finds a session, P2-P5 are never evaluated.
 * This prevents recommending a new topic while the student is mid-session.
 *
 * Uses a compound index on StructuredSession: @@index([studentId, state]) -- O(log n).
 */
async function p1_resumeSession(studentId: string): Promise<NextAction | null> {
  // ── 1a. StructuredSession -- primary path for new-engine students ──────────

  // Local row type for structuredSession
  type StructuredSessionRow = {
    id: string;
    topicId: string;
    state: string;
    topic: { name: string; chapter: { name: string; subject: { name: string } } };
  } | null;
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
  }) as StructuredSessionRow;

  if (structured) {
    // state is guaranteed to be one of the SessionPhase values -- COMPLETE and EXPIRED
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

  // ── 1b. LearningSession -- legacy fallback for pre-StructuredSession students ─
  // Only runs when no active StructuredSession was found above.
  // Local row type for learningSession
  type LearningSessionRow = {
    id: string;
    activityType: string;
    activityRef: string | null;
    meta: unknown;
  } | null;
  const legacy = await prisma.learningSession.findFirst({
    where: { studentId, isCompleted: false },
    orderBy: { lastAccessed: 'desc' },
    select: {
      id: true,
      activityType: true,
      activityRef: true,
      meta: true,
    },
  }) as LearningSessionRow;
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
    // No resumePhase for legacy sessions -- they pre-date structured phases.
  };
}

/**
 * P2 -- Weak topic (urgent).
 *
 * Selects from pre-fetched progress rows (no DB call).
 * Fires when the student has practiced meaningfully (practiceCount > 5)
 * but mastery remains critically low (< 0.4).
 * Returns the worst-mastery row first.
 */
async function p2_weakTopicUrgent(rows: ProgressRow[]): Promise<NextAction | null> {
  const best = rows
    .filter((r) => r.mastery < 0.4 && r.practiceCount > 5)
    .reduce<ProgressRow | null>((min, r) => (min === null || r.mastery < min.mastery ? r : min), null);
  if (!best) return null;

  const enriched = await enrichTopic(best.topicId, { topicName: null, subject: null, chapter: null });
  return {
    topicId: best.topicId,
    topicName: enriched.topicName,
    subject: enriched.subject,
    chapter: enriched.chapter,
    ruleId: 'weak_topic_urgent',
    reasonLabel: `Strengthen your understanding of ${enriched.topicName ?? 'this topic'}`,
    actionType: 'practice',
    accuracy: best.mastery,
  };
}

/**
 * P3 -- Spaced revision (dynamic interval).
 *
 * Selects from pre-fetched progress rows (no DB call -- reuses P2's fetch).
 *
 * Uses SPACED_REVISION_INTERVALS to derive a mastery-band interval:
 *   0.40-0.60 → 3 days   |   0.60-0.75 → 7 days
 *   0.75-0.90 → 14 days  |   0.90-1.00 → 30 days
 *
 * A topic is a candidate when daysSince >= intervalDays.
 * Among candidates, the topic with the largest overdueDays wins.
 * reasonLabel includes the exact days elapsed for student context.
 */
async function p3_spacedRevision(rows: ProgressRow[]): Promise<NextAction | null> {
  const todayOrdinal = floorDays(Date.now());

  type Candidate = ProgressRow & { daysSince: number; overdueDays: number };
  const candidates: Candidate[] = [];

  for (const row of rows) {
    const intervalDays = lookupSpacedInterval(row.mastery);
    if (intervalDays === null) continue; // mastery < 0.40 -- P2's domain
    // Normalize to calendar days so a student who studied at 23:50 isn't shown
    // as "1 day ago" 10 minutes later -- intervals advance at day boundaries.
    const daysSince = todayOrdinal - floorDays(row.lastStudiedAt.getTime());
    if (daysSince < intervalDays) continue; // not yet overdue
    candidates.push({ ...row, daysSince, overdueDays: daysSince - intervalDays });
  }

  if (candidates.length === 0) return null;

  // Most overdue first (largest overdueDays = studied longest ago relative to its interval)
  const best = candidates.reduce((max, c) => (c.overdueDays > max.overdueDays ? c : max));
  const days = best.daysSince; // already a whole number (calendar-day ordinal diff)

  const enriched = await enrichTopic(best.topicId, { topicName: null, subject: null, chapter: null });
  return {
    topicId: best.topicId,
    topicName: enriched.topicName,
    subject: enriched.subject,
    chapter: enriched.chapter,
    ruleId: 'spaced_revision',
    reasonLabel: `Time to revisit ${enriched.topicName ?? 'this topic'} -- it's been ${days} days.`,
    actionType: 'revision',
    accuracy: best.mastery,
  };
}

/**
 * P4 -- Inactive return.
 *
 * Selects from pre-fetched progress rows (no DB call -- reuses P2's fetch).
 * Fires when the student's most recent curriculum study is 3+ days ago,
 * surfacing their last topic as a "welcome back" prompt.
 */
async function p4_inactiveReturn(rows: ProgressRow[]): Promise<NextAction | null> {
  if (rows.length === 0) return null;

  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

  // Most-recently studied topic across all curriculum rows
  const lastStudied = rows.reduce((max, r) =>
    r.lastStudiedAt.getTime() > max.lastStudiedAt.getTime() ? r : max,
  );

  // Student is active (studied within 3 days) or no history → skip
  if (lastStudied.lastStudiedAt.getTime() >= threeDaysAgo) return null;

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
 * P5 -- Scored topic recommendation using TopicRanker signals.
 *
 * Replaces the old "first unattempted topic" selection with a full multi-signal
 * scoring pass over the curriculum frontier (first FRONTIER_SIZE topics after
 * the student's last mastered position).
 *
 * Signals applied (see lib/recommendations/topicRanker.ts for weights):
 *   weakTopicBoost       -- student has struggled here
 *   curriculumNextBoost  -- natural next topic in syllabus
 *   recencyPenalty       -- studied < 24 h ago
 *   prerequisitePenalty  -- prior topic not mastered
 *   weakSubjectBoost     -- flagged weak subject
 *   momentumBoost        -- scaled by engagement score
 *
 * Returns both the recommended NextAction and the full scored list so the
 * caller can attach the signal breakdown to the RecommendationTrace without
 * an extra DB round-trip.
 *
 * @param studentId     - Student being recommended for.
 * @param orderedTopics - Already-fetched curriculum (from getOrderedTopicsForStudent).
 *                        Passed as preloaded to rankTopics to avoid a duplicate fetch.
 */
async function p5_scoredTopic(
  studentId: string,
  orderedTopics: OrderedTopic[],
): Promise<{ action: NextAction | null; scoredTopics: ScoredTopic[] }> {
  if (orderedTopics.length === 0) return { action: null, scoredTopics: [] };

  const scored = await rankTopics(studentId, { preloadedOrderedTopics: orderedTopics });
  if (scored.length === 0) return { action: null, scoredTopics: scored };

  const best = scored[0];

  return {
    action: {
      topicId: best.topicId,
      topicName: best.topicName,
      subject: best.subjectName,
      chapter: best.chapterName,
      ruleId: 'next_new_topic',
      reasonLabel: p5ReasonLabel(best),
      actionType: p5ActionType(best),
    },
    scoredTopics: scored,
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
 * Short-circuits at the first matching priority -- never runs all 5 queries.
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
 * Short-circuits at the first matching priority -- never runs all rules.
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
  // Detailed per-rule entries for RecommendationTrace (Phase 6 observability).
  const ruleEntries: RuleEntry[] = [];
  // Scored topics from P5 -- populated only when TopicRanker runs.
  let scoredTopicsForTrace: ScoredTopic[] = [];

  // ── P0 -- Homework blocker (hard gate) ────────────────────────────────────────
  // Fires before any other rule. A PENDING/OVERDUE assignment due within 48 h
  // takes absolute priority -- the student must complete it first.
  trace.rulesEvaluated.push('P0');
  const p0Start = Date.now();
  const p0 = await p0_homeworkBlocker(studentId);
  ruleEntries.push({ ruleId: 'homework_pending', evaluated: true, matched: p0 !== null, durationMs: Date.now() - p0Start });
  if (p0) {
    trace.matchedRule = 'homework_pending';
    trace.finalDecision = 'homework_pending';
    return finalise(p0, traceId, studentId, { trace, returnTrace, startMs, ruleEntries });
  }

  // ── P1 -- Resume session ───────────────────────────────────────────────────────
  // Checks StructuredSession first (new engine), then LearningSession (legacy).
  // When P1 fires, P2-P5 are never evaluated -- the student must finish the
  // in-progress session before the engine recommends a new topic.
  trace.rulesEvaluated.push('P1');
  const p1Start = Date.now();
  const p1 = await p1_resumeSession(studentId);
  ruleEntries.push({ ruleId: 'resume_session', evaluated: true, matched: p1 !== null, durationMs: Date.now() - p1Start });
  if (p1) {
    trace.matchedRule = 'resume_session';
    trace.finalDecision = 'resume_session';
    return finalise(p1, traceId, studentId, { trace, returnTrace, startMs, ruleEntries });
  }

  // ── CURRICULUM RULES P2-P5 ─────────────────────────────────────────────────
  // Guaranteed: no blocking homework (P0) and no active session (P1).
  // Safe to recommend a new or revision topic.
  //
  // Use preloaded topics when available (dashboard passes them to avoid a
  // duplicate curriculum fetch). Fall back to a fresh query otherwise.
  const orderedTopics =
    options.preloadedOrderedTopics ?? (await getOrderedTopicsForStudent(studentId));
  const allowedTopicIds = new Set(orderedTopics.map((t: OrderedTopic) => t.id));

  // Local row type for studentTopicProgress
  type ProgressRowStrict = { topicId: string; mastery: number; practiceCount: number; lastStudiedAt: Date };
  // Single shared progress fetch for P2 + P3 + P4 -- one round-trip covers all three rules.
  // Scoped to the student's curriculum (allowedTopicIds) to exclude stale/cross-grade rows.
  const progressRows: ProgressRowStrict[] = allowedTopicIds.size > 0
    ? await prisma.studentTopicProgress.findMany({
        where: { studentId, topicId: { in: [...allowedTopicIds] } },
        select: { topicId: true, mastery: true, practiceCount: true, lastStudiedAt: true },
      }) as ProgressRowStrict[]
    : [];

  let action: NextAction | null;

  // P2 -- Weak topic: mastery < 0.4 AND practiceCount > 5 (in-memory filter on progressRows)
  trace.rulesEvaluated.push('P2');
  const p2Start = Date.now();
  action = await p2_weakTopicUrgent(progressRows);
  ruleEntries.push({ ruleId: 'weak_topic_urgent', evaluated: true, matched: action !== null, durationMs: Date.now() - p2Start });
  if (action) {
    trace.matchedRule = action.ruleId;
    trace.finalDecision = action.ruleId;
    return finalise(action, traceId, studentId, { trace, returnTrace, startMs, ruleEntries });
  }

  // P3 -- Spaced revision: dynamic interval per mastery band (in-memory, most overdue wins)
  trace.rulesEvaluated.push('P3');
  const p3Start = Date.now();
  action = await p3_spacedRevision(progressRows);
  ruleEntries.push({ ruleId: 'spaced_revision', evaluated: true, matched: action !== null, durationMs: Date.now() - p3Start });
  if (action) {
    trace.matchedRule = action.ruleId;
    trace.finalDecision = action.ruleId;
    return finalise(action, traceId, studentId, { trace, returnTrace, startMs, ruleEntries });
  }

  // P4 -- Inactive return: no study in 3+ days (in-memory, most recently studied topic)
  trace.rulesEvaluated.push('P4');
  const p4Start = Date.now();
  action = await p4_inactiveReturn(progressRows);
  ruleEntries.push({ ruleId: 'inactive_return', evaluated: true, matched: action !== null, durationMs: Date.now() - p4Start });
  if (action) {
    trace.matchedRule = action.ruleId;
    trace.finalDecision = action.ruleId;
    return finalise(action, traceId, studentId, { trace, returnTrace, startMs, ruleEntries });
  }

  // P5 -- Scored next topic via TopicRanker
  trace.rulesEvaluated.push('P5');
  const p5Start = Date.now();
  const p5Result = await p5_scoredTopic(studentId, orderedTopics);
  action = p5Result.action;
  scoredTopicsForTrace = p5Result.scoredTopics;
  ruleEntries.push({ ruleId: 'next_new_topic', evaluated: true, matched: action !== null, durationMs: Date.now() - p5Start });

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
      reasonLabel: 'All topics completed -- try a revision test',
      actionType: 'revision',
      estimatedTimeMin: 20,
    };
    ruleEntries.push({ ruleId: 'all_topics_complete', evaluated: true, matched: true, durationMs: 0 });
  }
  trace.matchedRule = action.ruleId;
  trace.finalDecision = action.ruleId;

  return finalise(action, traceId, studentId, {
    trace,
    returnTrace,
    startMs,
    ruleEntries,
    scoredTopics: scoredTopicsForTrace,
  });
}

// ─── Finalise helper ──────────────────────────────────────────────────────────

interface FinaliseOptions {
  trace?: NextActionTrace;
  returnTrace?: boolean;
  startMs?: number;
  /** Per-rule timing entries for Phase 6 RecommendationTrace observability. */
  ruleEntries?: RuleEntry[];
  /** Full ranked-topic list from P5 (TopicRanker); absent when P0-P4 short-circuited. */
  scoredTopics?: ScoredTopic[];
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

  // ── Phase 6: RecommendationTrace -- fire-and-forget Redis write ───────────────
  // Gated by ENABLE_REC_TRACE=1 AND a sampling roll (default 5 %).
  // Never awaited -- must not block the response.
  if (isRecTraceEnabled() && opts?.ruleEntries && Math.random() < TRACE_SAMPLE_RATE) {
    // Pad un-evaluated rules with { evaluated: false } so the full P0-P6 ladder
    // is always visible in the trace, making short-circuit behaviour explicit.
    const evaluatedIds = new Set(opts.ruleEntries.map((r) => r.ruleId));
    const fullRules: RuleEntry[] = ALL_RULE_IDS.map((ruleId) => {
      const existing = opts.ruleEntries!.find((r) => r.ruleId === ruleId);
      if (existing) return existing;
      // Rule was not reached -- short-circuited by an earlier match.
      return { ruleId, evaluated: false, matched: false, durationMs: 0 };
    });
    // Append any entries whose ruleId isn't in ALL_RULE_IDS (forward compat).
    for (const entry of opts.ruleEntries) {
      if (!evaluatedIds.has(entry.ruleId) || !ALL_RULE_IDS.includes(entry.ruleId)) {
        fullRules.push(entry);
      }
    }

    const recTrace: RecommendationTrace = {
      traceId,
      studentId,
      evaluatedAt: new Date(),
      rules: fullRules,
      finalDecision: action,
      ...(opts.scoredTopics && opts.scoredTopics.length > 0
        ? {
            topicScoringBreakdown: opts.scoredTopics.map((t) => ({
              topicId: t.topicId,
              topicName: t.topicName,
              totalScore: t.score,
              signals: t.signals,
            })),
          }
        : {}),
    };
    // void = intentional fire-and-forget; errors logged inside persistRecTrace.
    void persistRecTrace(recTrace);
  }

  if (opts?.returnTrace && opts.trace) {
    return { action, traceId, trace: opts.trace };
  }
  if (process.env.NODE_ENV !== 'production') {
    return { action, traceId };
  }

  return action;
}
