/**
 * FILE OBJECTIVE:
 * - Rank curriculum topics for a student and return the single best "next topic to study".
 * - Runs parallel to the existing recommendation engine (engine.ts).
 * - Scoring signals: weak-topic boost, curriculum-next boost, recency penalty, prerequisite penalty.
 * - Gated by ENABLE_TOPIC_RECOMMENDATION feature flag.
 *
 * EDIT LOG:
 * - 2026-03-06 | claude | created topic ranker with four scoring signals
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import { computeMomentumScore } from '@/lib/learning/momentumScore';
import { getWeakTopicIds } from '@/lib/learning/getWeakTopics';

// ─── Cache ───────────────────────────────────────────────────────────────────

const CACHE_PREFIX = 'topic-ranker:';
const CACHE_TTL_SECONDS = 5 * 60;

// ─── Feature Flag ────────────────────────────────────────────────────────────

export function isTopicRecommendationEnabled(): boolean {
  const flag = process.env.ENABLE_TOPIC_RECOMMENDATION;
  return flag === '1' || flag === 'true';
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TopicRecommendation {
  topicId: string;
  topicTitle: string;
  subject: string;
  chapter: string;
  reason: string;
}

interface ScoredTopic {
  topicId: string;
  topicName: string;
  chapterId: string;
  chapterName: string;
  subjectName: string;
  /** Curriculum position: chapter order * 1000 + topic order */
  curriculumOrder: number;
  score: number;
  signals: Record<string, number>;
}

// ─── Score Weights ───────────────────────────────────────────────────────────

const WEIGHTS = {
  /** Topics where mastery < 0.4 and practiceCount > 5 (student struggled) */
  WEAK_TOPIC_BOOST: 40,
  /** The next un-started topic in curriculum order */
  CURRICULUM_NEXT_BOOST: 30,
  /** Topics with incomplete sessions get a resume boost */
  INCOMPLETE_SESSION_BOOST: 25,
  /** Penalty for topics studied very recently (< 1 day ago) */
  RECENCY_PENALTY: -20,
  /** Penalty when the previous topic in sequence has low mastery */
  PREREQUISITE_PENALTY: -15,
  /** Small boost for topics in weak subjects */
  WEAK_SUBJECT_BOOST: 15,
  /** Boost scaled by learning momentum (0–1 engagement intensity) */
  MOMENTUM_BOOST: 20,
  /** Base score so every topic starts positive */
  BASE: 10,
} as const;

const MASTERY_THRESHOLD_WEAK = 0.4;
const MASTERY_THRESHOLD_MASTERED = 0.8;
const RECENCY_HOURS = 24;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns the single best next topic for a student to study.
 * Results are cached in Redis for 5 minutes to avoid repeated heavy
 * computation on every dashboard load.
 * Returns null when the feature flag is off or no eligible topics exist.
 */
export async function getNextTopicRecommendation(
  studentId: string,
): Promise<TopicRecommendation | null> {
  if (!isTopicRecommendationEnabled()) return null;

  const cacheKey = `${CACHE_PREFIX}${studentId}`;

  // ── Try cache ───────────────────────────────────────────────────────────
  try {
    const redis = getRedis();
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug('[TOPIC_RANKER_CACHE] hit', { studentId, cacheKey });
      return JSON.parse(cached) as TopicRecommendation;
    }
  } catch (err) {
    logger.warn('[TOPIC_RANKER_CACHE] read error, falling back to compute', {
      studentId,
      error: String(err),
    });
  }

  // ── Cache miss — compute ────────────────────────────────────────────────
  const scored = await rankTopics(studentId);
  if (scored.length === 0) return null;

  const best = scored[0];

  logger.info('[TOPIC_RECOMMENDATION]', {
    studentId,
    topicId: best.topicId,
    score: best.score,
    signals: best.signals,
  });

  const recommendation: TopicRecommendation = {
    topicId: best.topicId,
    topicTitle: best.topicName,
    subject: best.subjectName,
    chapter: best.chapterName,
    reason: pickReason(best),
  };

  // ── Store in cache ──────────────────────────────────────────────────────
  try {
    const redis = getRedis();
    await redis.set(cacheKey, JSON.stringify(recommendation), 'EX', CACHE_TTL_SECONDS);
    logger.debug('[TOPIC_RANKER_CACHE] stored', { studentId, cacheKey, ttl: CACHE_TTL_SECONDS });
  } catch (err) {
    logger.warn('[TOPIC_RANKER_CACHE] write error', {
      studentId,
      error: String(err),
    });
  }

  return recommendation;
}

/**
 * Invalidate the cached recommendation for a student.
 * Call after events that change ranking signals (e.g. session completion,
 * practice submission, mastery update).
 */
export async function invalidateTopicRankerCache(studentId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(`${CACHE_PREFIX}${studentId}`);
    logger.debug('[TOPIC_RANKER_CACHE] invalidated', { studentId });
  } catch (err) {
    logger.warn('[TOPIC_RANKER_CACHE] invalidation error', {
      studentId,
      error: String(err),
    });
  }
}

// ─── Core Algorithm ──────────────────────────────────────────────────────────

async function rankTopics(studentId: string): Promise<ScoredTopic[]> {
  const [user, profile, allProgress, recentSessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: { subjects: true, grade: true, board: true },
    }),
    prisma.studentLearningProfile.findUnique({
      where: { studentId },
      select: { weakSubjects: true },
    }),
    prisma.studentTopicProgress.findMany({
      where: { studentId },
    }),
    prisma.learningSession.findMany({
      where: { studentId },
      orderBy: { lastAccessed: 'desc' },
      take: 30,
      select: {
        activityRef: true,
        meta: true,
        isCompleted: true,
        completionPercentage: true,
        lastAccessed: true,
      },
    }),
  ]);

  if (!user) return [];

  const userSubjects = (user.subjects ?? []) as string[];
  const weakSubjects = new Set((profile?.weakSubjects ?? []) as string[]);

  // ── Fetch curriculum topics in order ────────────────────────────────────
  const curriculumTopics = await prisma.topicDef.findMany({
    where: {
      lifecycle: 'active',
      ...(userSubjects.length > 0
        ? { chapter: { lifecycle: 'active', subject: { lifecycle: 'active', name: { in: userSubjects } } } }
        : { chapter: { lifecycle: 'active', subject: { lifecycle: 'active' } } }),
    },
    include: {
      chapter: {
        select: {
          id: true,
          name: true,
          order: true,
          subject: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ chapter: { order: 'asc' } }, { order: 'asc' }],
  });

  if (curriculumTopics.length === 0) return [];

  // ── Compute student-wide signals in parallel ──────────────────────────
  const [momentum, weakTopicIdSet] = await Promise.all([
    computeMomentumScore(studentId),
    getWeakTopicIds(studentId),
  ]);

  // ── Build lookup maps ──────────────────────────────────────────────────
  type TopicProgress = (typeof allProgress)[number];
  const progressByTopic = new Map<string, TopicProgress>(allProgress.map((p) => [p.topicId, p]));

  const incompleteTopicIds = new Set<string>();
  for (const s of recentSessions) {
    if (s.isCompleted || (s.completionPercentage ?? 0) >= 80) continue;
    const tid = extractTopicId(s.activityRef, s.meta);
    if (tid) incompleteTopicIds.add(tid);
  }

  const recentlyStudiedTopicIds = new Map<string, Date>();
  for (const s of recentSessions) {
    const tid = extractTopicId(s.activityRef, s.meta);
    if (tid && !recentlyStudiedTopicIds.has(tid)) {
      recentlyStudiedTopicIds.set(tid, s.lastAccessed);
    }
  }

  // ── Find "curriculum frontier" — first un-started topic ────────────────
  let firstUnstartedId: string | null = null;
  for (const t of curriculumTopics) {
    const prog = progressByTopic.get(t.id);
    if (!prog || prog.practiceCount === 0) {
      firstUnstartedId = t.id;
      break;
    }
  }

  // ── Build ordered ID list for prerequisite lookups ─────────────────────
  const orderedIds = curriculumTopics.map((t) => t.id);
  const indexById = new Map<string, number>(orderedIds.map((id, i) => [id, i]));

  // ── Score each topic ───────────────────────────────────────────────────
  const now = Date.now();
  const scored: ScoredTopic[] = [];

  for (const topic of curriculumTopics) {
    const progress = progressByTopic.get(topic.id);
    const mastery = progress?.mastery ?? 0;
    const practiceCount = progress?.practiceCount ?? 0;
    const signals: Record<string, number> = {};

    // Skip fully mastered topics
    if (mastery >= MASTERY_THRESHOLD_MASTERED && practiceCount >= 5) continue;

    let score = WEIGHTS.BASE;

    // 1. Weak topic boost (mastery < 0.4 AND practiceCount > 5)
    if (weakTopicIdSet.has(topic.id)) {
      signals.weakTopicBoost = WEIGHTS.WEAK_TOPIC_BOOST;
      score += WEIGHTS.WEAK_TOPIC_BOOST;
    }

    // 2. Curriculum-next boost
    if (topic.id === firstUnstartedId) {
      signals.curriculumNextBoost = WEIGHTS.CURRICULUM_NEXT_BOOST;
      score += WEIGHTS.CURRICULUM_NEXT_BOOST;
    }

    // 3. Incomplete session boost
    if (incompleteTopicIds.has(topic.id)) {
      signals.incompleteSessionBoost = WEIGHTS.INCOMPLETE_SESSION_BOOST;
      score += WEIGHTS.INCOMPLETE_SESSION_BOOST;
    }

    // 4. Recency penalty
    const lastAccess = recentlyStudiedTopicIds.get(topic.id);
    if (lastAccess) {
      const hoursAgo = (now - lastAccess.getTime()) / (1000 * 60 * 60);
      if (hoursAgo < RECENCY_HOURS) {
        const penalty = Math.round(WEIGHTS.RECENCY_PENALTY * (1 - hoursAgo / RECENCY_HOURS));
        signals.recencyPenalty = penalty;
        score += penalty;
      }
    }

    // 5. Prerequisite penalty
    const myIndex = indexById.get(topic.id) ?? -1;
    if (myIndex > 0) {
      const prevId = orderedIds[myIndex - 1];
      const prevProgress = progressByTopic.get(prevId);
      const prevMastery = prevProgress?.mastery ?? 0;
      if (prevMastery < MASTERY_THRESHOLD_WEAK && (prevProgress?.practiceCount ?? 0) > 0) {
        signals.prerequisitePenalty = WEIGHTS.PREREQUISITE_PENALTY;
        score += WEIGHTS.PREREQUISITE_PENALTY;
      }
    }

    // 6. Weak subject boost
    if (weakSubjects.has(topic.chapter.subject.name)) {
      signals.weakSubjectBoost = WEIGHTS.WEAK_SUBJECT_BOOST;
      score += WEIGHTS.WEAK_SUBJECT_BOOST;
    }

    // 7. Momentum boost — rewards consistent engagement
    if (momentum.score > 0) {
      const boost = Math.round(WEIGHTS.MOMENTUM_BOOST * momentum.score);
      signals.momentumBoost = boost;
      score += boost;
    }

    scored.push({
      topicId: topic.id,
      topicName: topic.name,
      chapterId: topic.chapter.id,
      chapterName: topic.chapter.name,
      subjectName: topic.chapter.subject.name,
      curriculumOrder: topic.chapter.order * 1000 + topic.order,
      score,
      signals,
    });
  }

  // Sort by score descending; tie-break by curriculum order (earlier first)
  scored.sort((a, b) => b.score - a.score || a.curriculumOrder - b.curriculumOrder);

  return scored;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractTopicId(activityRef: string | null, meta: unknown): string | null {
  const m = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
  if (typeof m.topicId === 'string' && m.topicId) return m.topicId;
  if (typeof m.topic === 'string' && m.topic) return m.topic;
  if (!activityRef) return null;
  if (activityRef.includes(':')) return activityRef.split(':')[1] || null;
  return activityRef;
}

function pickReason(topic: ScoredTopic): string {
  const s = topic.signals;
  if (s.incompleteSessionBoost) return 'Continue where you left off';
  if (s.weakTopicBoost && s.weakTopicBoost > 0) return 'Strengthen this weak topic';
  if (s.curriculumNextBoost && s.curriculumNextBoost > 0) return 'Next topic in your syllabus';
  if (s.weakSubjectBoost && s.weakSubjectBoost > 0) return 'Focus on a weak subject';
  return 'Recommended for you';
}
