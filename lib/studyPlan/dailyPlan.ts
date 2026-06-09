/**
 * FILE OBJECTIVE:
 * - Compute and cache a student's 3-topic daily study plan from mastery state.
 *   Uses Redis with IST-midnight expiry to keep the home screen zero-latency.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial creation for S2-4 Daily Study Plan
 */

import { MasteryState } from '@prisma/client';
import { getProgressByState } from '@/lib/mastery/topicProgress';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_TOPIC_LIMIT = 3;
const DEVELOPING_FETCH_LIMIT = 10;
const NOT_STARTED_FETCH_LIMIT = 10;
const IST_OFFSET_MINUTES = 330; // UTC+5:30
const PLAN_CACHE_PREFIX = 'plan';
const LOW_SCORE_THRESHOLD = 0.40;
const LOW_SCORE_DIFFICULTY = 3;
const DEFAULT_DIFFICULTY = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudyPlanTopic {
  topicSlug: string;
  subject: string;
  grade: string;
  board: string;
  state: MasteryState;
  score: number;
  lastStudiedAt: Date | null;
  suggestedDifficulty: number;
}

export interface DailyPlan {
  topics: StudyPlanTopic[];
  generatedAt: Date;
}

// ─── IST helpers ──────────────────────────────────────────────────────────────

function todayIST(): string {
  const nowIST = new Date(Date.now() + IST_OFFSET_MINUTES * 60_000);
  const y = nowIST.getUTCFullYear();
  const m = String(nowIST.getUTCMonth() + 1).padStart(2, '0');
  const d = String(nowIST.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nextISTMidnightUnix(): number {
  const nowIST = new Date(Date.now() + IST_OFFSET_MINUTES * 60_000);
  // Start of tomorrow in IST, expressed as a UTC timestamp
  const tomorrowISTMidnightUTC = Date.UTC(
    nowIST.getUTCFullYear(),
    nowIST.getUTCMonth(),
    nowIST.getUTCDate() + 1,
  ) - IST_OFFSET_MINUTES * 60_000;
  return Math.floor(tomorrowISTMidnightUTC / 1000);
}

function planCacheKey(userId: string): string {
  return `${PLAN_CACHE_PREFIX}:${userId}:${todayIST()}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Computes a daily study plan of up to 3 topics.
 * Priority: DEVELOPING (idle-first, sorted by lastStudiedAt ASC)
 *           -> NOT_STARTED.
 */
export async function computeDailyPlan(userId: string): Promise<DailyPlan> {
  const [developing, notStarted] = await Promise.all([
    getProgressByState(userId, MasteryState.DEVELOPING, DEVELOPING_FETCH_LIMIT),
    getProgressByState(userId, MasteryState.NOT_STARTED, NOT_STARTED_FETCH_LIMIT),
  ]);

  const combined: StudyPlanTopic[] = [
    ...developing.map((t) => ({
      topicSlug: t.topicSlug,
      subject: t.subject,
      grade: t.grade,
      board: t.board,
      state: t.state,
      score: t.score,
      lastStudiedAt: t.lastStudiedAt,
      suggestedDifficulty:
        t.score < LOW_SCORE_THRESHOLD ? LOW_SCORE_DIFFICULTY : DEFAULT_DIFFICULTY,
    })),
    ...notStarted.map((t) => ({
      topicSlug: t.topicSlug,
      subject: t.subject,
      grade: t.grade,
      board: t.board,
      state: t.state,
      score: t.score,
      lastStudiedAt: t.lastStudiedAt,
      suggestedDifficulty: DEFAULT_DIFFICULTY,
    })),
  ];

  return {
    topics: combined.slice(0, PLAN_TOPIC_LIMIT),
    generatedAt: new Date(),
  };
}

/**
 * Serialises and stores a daily plan in Redis, expiring at next IST midnight.
 */
export async function cacheDailyPlan(userId: string, plan: DailyPlan): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const key = planCacheKey(userId);
  const expireAt = nextISTMidnightUnix();
  try {
    await redis.set(key, JSON.stringify(plan));
    await redis.expireat(key, expireAt);
    logger.info('studyPlan.cache.set', { userId, key, expireAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('studyPlan.cache.set.failed', { userId, error: message });
  }
}

/**
 * Returns the cached daily plan for today (IST), or null on cache miss.
 */
export async function getCachedDailyPlan(userId: string): Promise<DailyPlan | null> {
  const redis = getRedis();
  if (!redis) return null;

  const key = planCacheKey(userId);
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyPlan;
    // Rehydrate Date fields serialised as strings by JSON.stringify
    parsed.generatedAt = new Date(parsed.generatedAt);
    parsed.topics = parsed.topics.map((t) => ({
      ...t,
      lastStudiedAt: t.lastStudiedAt ? new Date(t.lastStudiedAt as unknown as string) : null,
    }));
    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('studyPlan.cache.get.failed', { userId, error: message });
    return null;
  }
}
