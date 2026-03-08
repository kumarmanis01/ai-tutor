/**
 * FILE OBJECTIVE:
 * - RecommendationTrace: structured observability record for the Home Tutor Engine.
 * - Captures every rule evaluated by getNextAction(), per-rule timing, topic
 *   scoring signals from P5 (TopicRanker), and the final NextAction decision.
 * - Persisted to Redis (key: rec-trace:{studentId}, TTL: 10 min) as fire-and-forget.
 * - Read by GET /api/admin/recommendation-trace for admin debugging.
 * - Enabled only when ENABLE_REC_TRACE=1.
 *
 * LINKED UNIT TEST:
 * - (no integration tests — Redis calls are fire-and-forget and cannot block
 *   the recommendation path; acceptance verified via admin API endpoint)
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | Phase 6: created for Spinzy recommendation observability
 */

import type { NextAction } from './getNextAction';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * A single rule slot in the evaluation trace.
 * Even rules that were not evaluated (e.g. P2–P5 when P0 fires) are included
 * with evaluated: false so the admin UI can show the complete P0–P6 ladder.
 */
export interface RuleEntry {
  /** Human-readable rule identifier matching NextAction.ruleId (e.g. 'homework_pending'). */
  ruleId: string;
  /** Whether the rule's sub-function was actually invoked this call. */
  evaluated: boolean;
  /** Whether the rule produced a matching NextAction (true = short-circuit fired here). */
  matched: boolean;
  /** Wall-clock milliseconds consumed by the rule's evaluation (DB + compute). */
  durationMs: number;
}

/**
 * Per-topic scoring record captured from the P5 TopicRanker pass.
 * Only present when P0–P4 did not short-circuit (i.e. P5 was reached).
 */
export interface TopicScoringEntry {
  topicId: string;
  topicName: string;
  totalScore: number;
  /** Per-signal score contributions (e.g. { weakTopicBoost: 40, momentumBoost: 8 }). */
  signals: Record<string, number>;
}

/**
 * Full observability record for one getNextAction() invocation.
 * Written to Redis as fire-and-forget; TTL = 10 minutes.
 *
 * Schema:
 *   traceId           — UUID from the getNextAction call (same as logged to logger.info).
 *   studentId         — The student being recommended for.
 *   evaluatedAt       — Wall-clock time of the getNextAction() call (UTC).
 *   rules             — Ordered P0→P6 rule entries with timing and match status.
 *   topicScoringBreakdown — Present when P5 ran; full ranked-topic signal breakdown.
 *   finalDecision     — The NextAction returned to the caller.
 */
export interface RecommendationTrace {
  traceId: string;
  studentId: string;
  evaluatedAt: Date;
  rules: RuleEntry[];
  topicScoringBreakdown?: TopicScoringEntry[];
  finalDecision: NextAction;
}

// ─── Feature flag ─────────────────────────────────────────────────────────────

/**
 * Trace is opt-in: set ENABLE_REC_TRACE=1 in the environment.
 * When disabled, no Redis writes occur and getNextAction() runs at full speed.
 */
export function isRecTraceEnabled(): boolean {
  return process.env.ENABLE_REC_TRACE === '1';
}

// ─── Redis constants ──────────────────────────────────────────────────────────

const TRACE_KEY_PREFIX = 'rec-trace:';

/** 10 minutes — long enough for admin debugging, short enough to self-clean. */
const TRACE_TTL_SECONDS = 10 * 60;

// ─── Persistence ─────────────────────────────────────────────────────────────

/**
 * Persists a RecommendationTrace to Redis.
 *
 * MUST be called fire-and-forget (do NOT await on the critical path):
 *   void persistRecTrace(trace);
 *   // or: persistRecTrace(trace).catch(() => { / already logged / });
 *
 * Errors are swallowed internally — a Redis failure must never surface to the
 * student or affect the recommendation result.
 */
export async function persistRecTrace(trace: RecommendationTrace): Promise<void> {
  try {
    const redis = getRedis();
    const key = `${TRACE_KEY_PREFIX}${trace.studentId}`;
    // Overwrites any previous trace for this student (only latest is kept).
    await redis.set(key, JSON.stringify(trace, replaceDates), 'EX', TRACE_TTL_SECONDS);
    logger.debug('rec-trace.written', { traceId: trace.traceId, studentId: trace.studentId });
  } catch (err) {
    // Silently absorb — trace writes must never throw or block.
    logger.warn('rec-trace.write_failed', {
      traceId: trace.traceId,
      studentId: trace.studentId,
      error: String(err),
    });
  }
}

/**
 * Reads the most recent RecommendationTrace for a student from Redis.
 * Returns null when no trace exists or it has expired.
 *
 * Used exclusively by GET /api/admin/recommendation-trace.
 */
export async function readRecTrace(studentId: string): Promise<RecommendationTrace | null> {
  try {
    const redis = getRedis();
    const raw = await redis.get(`${TRACE_KEY_PREFIX}${studentId}`);
    if (!raw) return null;
    return JSON.parse(raw) as RecommendationTrace;
  } catch (err) {
    logger.warn('rec-trace.read_failed', { studentId, error: String(err) });
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Serialize Date → ISO string so Redis round-trips losslessly. */
function replaceDates(_key: string, value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
