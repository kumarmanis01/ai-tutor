/**
 * FILE OBJECTIVE:
 * - Internal topic scoring utility for the Home Tutor Engine.
 * - Scores curriculum topics using 7 signals and returns the ranked list.
 * - Called exclusively by p5_scoredTopic() inside getNextAction.ts.
 * - No longer a standalone public API -- the feature flag has been removed.
 *
 * Signal weights (documented for tuning):
 *   WEAK_TOPIC_BOOST       +40  mastery < 0.4 AND practiceCount > 5
 *   CURRICULUM_NEXT_BOOST  +30  first un-started topic in order
 *   RECENCY_PENALTY        -20  studied < 24 h ago (decays linearly)
 *   PREREQUISITE_PENALTY   -15  prior topic not yet sufficiently mastered
 *   WEAK_SUBJECT_BOOST     +15  topic belongs to a flagged weak subject
 *   MOMENTUM_BOOST         +20  scaled by student engagement (0-1)
 *   BASE                   +10  floor so every topic starts positive
 *
 * Frontier cap:
 *   Only the first FRONTIER_SIZE (50) unmastered topics after the last
 *   mastered position are scored. This prevents O(n) scans over full
 *   curricula and keeps P5 within the 50 ms latency budget.
 *
 * Recency signal source:
 *   StudentTopicProgress.lastStudiedAt -- always populated by the session
 *   engine on practice/test submit. No longer reads LearningSession.
 *
 * EDIT LOG:
 * - 2026-03-06 | Manish Kumar    | created with four scoring signals
 * - 2026-03-07 | Manish Kumar    | use CurriculumGraph for prerequisite checks
 * - 2026-03-07 | claude          | converted to internal utility: removed feature
 *                                  flag and getNextTopicRecommendation public API;
 *                                  added preloadedOrderedTopics option; switched
 *                                  recency to StudentTopicProgress.lastStudiedAt;
 *                                  added FRONTIER_SIZE cap (50 topics)
 * - 2026-03-07 | claude          | Phase 2: confirmed no LearningSession dependency
 *                                  remains; incomplete-session detection is handled
 *                                  exclusively by getNextAction P1 (StructuredSession
 *                                  query) before rankTopics is ever called -- so
 *                                  rankTopics never runs while a session is active
 * - 2026-04-23T00:00:00Z | copilot        | fix(strict): guard redis in cache invalidation and add typed progress rows
 * - 2026-05-07T00:00:00Z | copilot | fix(p5): score only topics that have at least one active Concept to prevent unresolved topicId -> conceptId start actions
 * - 2026-05-07T00:00:00Z | copilot | feat(observability): emit warning + email alert when frontier topics have no active concepts
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import { sendTopicRankerCoverageAlertSafe } from '@/lib/mail';
import { computeMomentumScore } from '@/lib/learning/momentumScore';
import { getWeakTopicIds } from '@/lib/learning/getWeakTopics';
import {
  getCurriculumGraph,
  arePrerequisitesMet,
  type CurriculumTopic,
} from '@/lib/curriculum/curriculumGraph';
import type { OrderedTopic } from '@/lib/homeEngine/getOrderedTopicsForStudent';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum number of topics scored in a single P5 call.
 * Scoring starts from the curriculum frontier (first unmastered topic) and
 * covers the next FRONTIER_SIZE topics. Topics before the frontier are
 * handled by P3/P4 (weak topic rules); topics far beyond are not relevant yet.
 */
export const FRONTIER_SIZE = 50;

/** Topics with mastery >= this value AND practiceCount >= 5 are skipped. */
const MASTERY_THRESHOLD_MASTERED = 0.8;

/**
 * Topics with mastery >= this value are considered "sufficiently mastered"
 * for the purpose of prerequisite checks. Does NOT skip scoring.
 */
const MASTERY_THRESHOLD_SUFFICIENT = 0.4;

/** Topics studied within this many hours receive a recency penalty. */
const RECENCY_HOURS = 24;

type ConceptTopicRow = {
  topicId: string;
};

// ─── Score weights ────────────────────────────────────────────────────────────

export const WEIGHTS = {
  WEAK_TOPIC_BOOST: 40,
  CURRICULUM_NEXT_BOOST: 30,
  RECENCY_PENALTY: -20,
  PREREQUISITE_PENALTY: -15,
  WEAK_SUBJECT_BOOST: 15,
  MOMENTUM_BOOST: 20,
  BASE: 10,
} as const;

// ─── Cache (invalidation only -- no longer caches ranked results here) ─────────
// Cache key kept for invalidateTopicRankerCache(), which is called by the
// domain event bus on session completion. The engine (getNextAction) is
// responsible for any result-level caching it chooses to add.

const CACHE_PREFIX = 'topic-ranker:';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ScoredTopic {
  topicId: string;
  topicName: string;
  chapterId: string;
  chapterName: string;
  subjectName: string;
  /** Curriculum position: chapterOrder × 1000 + topicOrder (for tie-breaking). */
  curriculumOrder: number;
  score: number;
  /** Per-signal score contributions -- used for observability and debug. */
  signals: Record<string, number>;
}

export interface RankTopicsOptions {
  /**
   * Pre-fetched ordered curriculum topics from the caller.
   * When provided, rankTopics uses this list directly instead of fetching
   * from the CurriculumGraph, avoiding a duplicate DB/Redis round-trip.
   * The list must already be filtered to the student's board/grade/subjects.
   */
  preloadedOrderedTopics?: OrderedTopic[];
}

// ─── Cache invalidation (public) ─────────────────────────────────────────────

/**
 * Invalidate any cached artefacts for a student.
 * Called by sessionEventListeners on SESSION_COMPLETED.
 */
export async function invalidateTopicRankerCache(studentId: string): Promise<void> {
  try {
    const redis = getRedis();
    if (redis) {
      await redis.del(`${CACHE_PREFIX}${studentId}`);
      logger.debug('[TOPIC_RANKER_CACHE] invalidated', { studentId });
    } else {
      logger.debug('[TOPIC_RANKER_CACHE] no-redis, skipping invalidation', { studentId });
    }
  } catch (err) {
    logger.warn('[TOPIC_RANKER_CACHE] invalidation error', { studentId, error: String(err) });
  }
}

// ─── Core scoring algorithm (exported for use by getNextAction P5) ────────────

/**
 * Score all eligible curriculum topics for a student and return them sorted
 * best-first. Scoring is bounded to the FRONTIER_SIZE topics immediately
 * after the student's curriculum frontier (first unmastered topic).
 *
 * @param studentId  - The student being recommended for.
 * @param options    - Optional preloaded topics to skip curriculum re-fetch.
 * @returns Scored topics sorted descending by score, tie-broken by curriculum order.
 */
export async function rankTopics(
  studentId: string,
  options: RankTopicsOptions = {},
): Promise<ScoredTopic[]> {
  // ── Fetch all signals in parallel ──────────────────────────────────────────
  // We always need: weakSubjects, allProgress, curriculumGraph, momentum, weakTopicIds.
  // The user query is only needed when no preloadedOrderedTopics are provided.
  const fetchUser = !options.preloadedOrderedTopics
    ? prisma.user.findUnique({ where: { id: studentId }, select: { subjects: true } })
    : Promise.resolve(null);

  const [user, profile, allProgress, graph, momentum, weakTopicIdSet] = await Promise.all([
    fetchUser,
    prisma.studentLearningProfile.findUnique({
      where: { studentId },
      select: { weakSubjects: true },
    }),
    prisma.studentTopicProgress.findMany({ where: { studentId } }),
    getCurriculumGraph(), // Redis-cached -- effectively free on warm paths
    computeMomentumScore(studentId),
    getWeakTopicIds(studentId),
  ]);

  const weakSubjects = new Set((profile?.weakSubjects ?? []) as string[]);

  // ── Resolve the ordered topic list ────────────────────────────────────────
  let curriculumTopics: CurriculumTopic[];

  if (options.preloadedOrderedTopics && options.preloadedOrderedTopics.length > 0) {
    // Caller already fetched and filtered the curriculum -- convert shape.
    curriculumTopics = options.preloadedOrderedTopics.map(orderedTopicToCurriculumTopic);
  } else {
    // Fallback: derive from CurriculumGraph filtered by student's enrolled subjects.
    const userSubjects = (user?.subjects ?? []) as string[];
    curriculumTopics =
      userSubjects.length > 0
        ? graph.topics.filter((t) => userSubjects.includes(t.subjectName))
        : graph.topics;
  }

  if (curriculumTopics.length === 0) return [];

  // ── Build lookup maps ──────────────────────────────────────────────────────
  // Local row shape for StudentTopicProgress (avoid importing Prisma client types here)
  type StudentTopicProgressRow = {
    topicId: string;
    mastery: number;
    practiceCount: number;
    lastStudiedAt?: Date | null;
  };

  const allProgressTyped = allProgress as StudentTopicProgressRow[];
  type ProgressRow = StudentTopicProgressRow;
  const progressByTopic = new Map<string, ProgressRow>(
    allProgressTyped.map((p) => [p.topicId, p]),
  );

  // For prerequisite checks: topics with sufficient mastery (>= 0.4, practiceCount > 0).
  const sufficientlyMasteredIds = new Set<string>(
    allProgressTyped
      .filter((p) => p.mastery >= MASTERY_THRESHOLD_SUFFICIENT && p.practiceCount > 0)
      .map((p) => p.topicId),
  );

  // ── Find the curriculum frontier ───────────────────────────────────────────
  // Frontier = first topic with no progress record OR practiceCount === 0.
  // We start scoring from here rather than from topic[0] to avoid rescoring
  // already-mastered topics and to focus the budget on what's actually next.
  let frontierStartIndex = 0;
  for (let i = 0; i < curriculumTopics.length; i++) {
    const prog = progressByTopic.get(curriculumTopics[i].topicId);
    if (!prog || prog.practiceCount === 0) {
      frontierStartIndex = i;
      break;
    }
    // All topics have been started -- frontier is the last one.
    if (i === curriculumTopics.length - 1) {
      frontierStartIndex = i;
    }
  }

  // ID of the very first unstarted topic -- receives CURRICULUM_NEXT_BOOST.
  const firstUnstartedId = curriculumTopics[frontierStartIndex]?.topicId ?? null;

  // Slice to FRONTIER_SIZE topics starting from the frontier.
  const frontierTopics = curriculumTopics.slice(
    frontierStartIndex,
    frontierStartIndex + FRONTIER_SIZE,
  );

  // Guardrail: only score topics that can immediately start a session.
  // A topic without at least one active Concept cannot resolve to /session/pre/[conceptId].
  const frontierTopicIds = frontierTopics.map((topic) => topic.topicId);
  const activeConceptTopics = frontierTopicIds.length > 0
    ? await prisma.concept.findMany({
        where: {
          topicId: { in: frontierTopicIds },
          isSuspended: false,
        },
        select: { topicId: true },
        distinct: ['topicId'],
      }) as ConceptTopicRow[]
    : [];
  const activeConceptTopicIds = new Set(activeConceptTopics.map((row) => row.topicId));
  const rankableFrontierTopics = frontierTopics.filter((topic) => activeConceptTopicIds.has(topic.topicId));
  const filteredOutTopicIds = frontierTopics
    .filter((topic) => !activeConceptTopicIds.has(topic.topicId))
    .map((topic) => topic.topicId);

  if (filteredOutTopicIds.length > 0) {
    logger.warn('[TOPIC_RANKER] filtered topics without active concept', {
      studentId,
      frontierSize: frontierTopics.length,
      rankableFrontierSize: rankableFrontierTopics.length,
      filteredTopicCount: filteredOutTopicIds.length,
      filteredTopicIds: filteredOutTopicIds,
    });

    void sendTopicRankerCoverageAlertSafe({
      studentId,
      frontierSize: frontierTopics.length,
      rankableFrontierSize: rankableFrontierTopics.length,
      filteredTopicIds: filteredOutTopicIds,
    });
  }

  // ── Score each frontier topic ──────────────────────────────────────────────
  const now = Date.now();
  const scored: ScoredTopic[] = [];

  for (const topic of rankableFrontierTopics) {
    const progress = progressByTopic.get(topic.topicId);
    const mastery = progress?.mastery ?? 0;
    const practiceCount = progress?.practiceCount ?? 0;
    const signals: Record<string, number> = {};

    // Skip fully mastered topics within the frontier.
    if (mastery >= MASTERY_THRESHOLD_MASTERED && practiceCount >= 5) continue;

    let score = WEIGHTS.BASE;
    signals.base = WEIGHTS.BASE;

    // 1. Weak topic boost -- student has tried this but is still struggling.
    if (weakTopicIdSet.has(topic.topicId)) {
      signals.weakTopicBoost = WEIGHTS.WEAK_TOPIC_BOOST;
      score += WEIGHTS.WEAK_TOPIC_BOOST;
    }

    // 2. Prerequisite penalty -- prior topic not yet sufficiently learned.
    const prereqsMet = arePrerequisitesMet(topic.topicId, graph, sufficientlyMasteredIds);
    if (!prereqsMet) {
      signals.prerequisitePenalty = WEIGHTS.PREREQUISITE_PENALTY;
      score += WEIGHTS.PREREQUISITE_PENALTY;
    }

    // 3. Curriculum-next boost -- this is the natural next step (only when prerequisites are met).
    if (prereqsMet && topic.topicId === firstUnstartedId) {
      signals.curriculumNextBoost = WEIGHTS.CURRICULUM_NEXT_BOOST;
      score += WEIGHTS.CURRICULUM_NEXT_BOOST;
    }

    // 4. Recency penalty -- penalise topics studied very recently.
    //    Uses StudentTopicProgress.lastStudiedAt (always populated by session engine).
    //    Penalty decays linearly: full penalty at 0 h, zero at RECENCY_HOURS.
    if (progress?.lastStudiedAt) {
      const hoursAgo = (now - progress.lastStudiedAt.getTime()) / (1_000 * 60 * 60);
      if (hoursAgo < RECENCY_HOURS) {
        const penalty = Math.round(WEIGHTS.RECENCY_PENALTY * (1 - hoursAgo / RECENCY_HOURS));
        signals.recencyPenalty = penalty;
        score += penalty;
      }
    }

    // 5. Weak subject boost -- topic is in a subject the student finds difficult.
    if (weakSubjects.has(topic.subjectName)) {
      signals.weakSubjectBoost = WEIGHTS.WEAK_SUBJECT_BOOST;
      score += WEIGHTS.WEAK_SUBJECT_BOOST;
    }

    // 6. Momentum boost -- reward students who are actively studying.
    if (momentum.score > 0) {
      const boost = Math.round(WEIGHTS.MOMENTUM_BOOST * momentum.score);
      signals.momentumBoost = boost;
      score += boost;
    }

    scored.push({
      topicId: topic.topicId,
      topicName: topic.topicName,
      chapterId: topic.chapterId,
      chapterName: topic.chapterName,
      subjectName: topic.subjectName,
      curriculumOrder: topic.chapterOrder * 1_000 + topic.topicOrder,
      score,
      signals,
    });
  }

  // Sort descending by score; tie-break by curriculum order (earlier topic wins).
  scored.sort((a, b) => b.score - a.score || a.curriculumOrder - b.curriculumOrder);

  logger.debug('[TOPIC_RANKER]', {
    studentId,
    frontierStartIndex,
    frontierSize: frontierTopics.length,
    rankableFrontierSize: rankableFrontierTopics.length,
    filteredTopicCount: filteredOutTopicIds.length,
    topResult: scored[0]
      ? { topicId: scored[0].topicId, score: scored[0].score, signals: scored[0].signals }
      : null,
  });

  return scored;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Convert an OrderedTopic (Prisma include shape from getOrderedTopicsForStudent)
 * to the CurriculumTopic shape expected by the scoring loop and arePrerequisitesMet.
 */
function orderedTopicToCurriculumTopic(t: OrderedTopic): CurriculumTopic {
  return {
    topicId: t.id,
    topicName: t.name,
    chapterId: t.chapter.id,
    chapterName: t.chapter.name,
    chapterOrder: t.chapter.order,
    subjectId: t.chapter.subject.id,
    subjectName: t.chapter.subject.name,
    topicOrder: t.order,
    parentId: t.parentId ?? null,
  };
}
