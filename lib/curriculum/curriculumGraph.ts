/**
 * CurriculumGraph — Learning Intelligence layer
 *
 * Builds and exposes the curriculum as a directed prerequisite graph.
 * Nodes are TopicDef IDs. Edges represent "must be studied before" relationships
 * derived from curriculum ordering (chapter.order × topic.order) and parentId
 * sub-topic links.
 *
 * Prerequisite rules (no schema changes needed):
 *   1. Within a chapter: topic[i] is a prerequisite of topic[i+1] (same chapter order)
 *   2. Across chapters: the last topic of chapter[j] is a prerequisite of the first
 *      topic of chapter[j+1] within the same subject.
 *   3. parentId: a child topic (sub-topic) has its parent as a prerequisite.
 *
 * The graph is built from Prisma on first access and cached in Redis for 30 min.
 * Call `invalidateCurriculumGraph()` after curriculum edits (admin promotion, etc.).
 *
 * EDIT LOG:
 *   2026-03-07 | Manish Kumar | created CurriculumGraph (Learning Intelligence layer)
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_KEY = 'curriculum-graph:v1';
const CACHE_TTL_SECONDS = 30 * 60; // 30 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CurriculumTopic {
  topicId: string;
  topicName: string;
  chapterId: string;
  chapterName: string;
  chapterOrder: number;
  subjectId: string;
  subjectName: string;
  topicOrder: number;
  parentId: string | null;
}

/**
 * Serialisable graph snapshot stored in Redis.
 */
export interface CurriculumGraphSnapshot {
  /** Ordered list of all active topics across all subjects */
  topics: CurriculumTopic[];
  /**
   * Prerequisite adjacency map: topicId → list of topicIds that must be
   * studied before it (i.e. its direct predecessors in the curriculum).
   */
  prerequisites: Record<string, string[]>;
  /**
   * Reverse map: topicId → list of topicIds that are unlocked by it.
   */
  dependents: Record<string, string[]>;
  builtAt: string;
}

// ─── Build Logic ─────────────────────────────────────────────────────────────

/**
 * Load all active topics from Prisma and build the prerequisite graph.
 * Expensive — results are always cached.
 */
async function buildGraph(): Promise<CurriculumGraphSnapshot> {
  const rawTopics = await prisma.topicDef.findMany({
    where: { lifecycle: 'active', chapter: { lifecycle: 'active', subject: { lifecycle: 'active' } } },
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
    orderBy: [{ chapter: { subject: { name: 'asc' } } }, { chapter: { order: 'asc' } }, { order: 'asc' }],
  });

  const topics: CurriculumTopic[] = rawTopics.map((t) => ({
    topicId: t.id,
    topicName: t.name,
    chapterId: t.chapter.id,
    chapterName: t.chapter.name,
    chapterOrder: t.chapter.order,
    subjectId: t.chapter.subject.id,
    subjectName: t.chapter.subject.name,
    topicOrder: t.order,
    parentId: t.parentId,
  }));

  const prerequisites: Record<string, string[]> = {};
  const dependents: Record<string, string[]> = {};

  // Initialise empty arrays
  for (const t of topics) {
    prerequisites[t.topicId] = [];
    dependents[t.topicId] = [];
  }

  function addEdge(from: string, to: string) {
    if (!prerequisites[to].includes(from)) {
      prerequisites[to].push(from);
    }
    if (!dependents[from].includes(to)) {
      dependents[from].push(to);
    }
  }

  // Group by subject, then by chapter (already sorted)
  const bySubject = new Map<string, CurriculumTopic[]>();
  for (const t of topics) {
    const list = bySubject.get(t.subjectId) ?? [];
    list.push(t);
    bySubject.set(t.subjectId, list);
  }

  for (const subjectTopics of bySubject.values()) {
    // Group by chapter within subject
    const byChapter = new Map<string, CurriculumTopic[]>();
    for (const t of subjectTopics) {
      const list = byChapter.get(t.chapterId) ?? [];
      list.push(t);
      byChapter.set(t.chapterId, list);
    }

    // Sort chapters by order
    const sortedChapters = [...byChapter.entries()].sort(
      ([, a], [, b]) => a[0].chapterOrder - b[0].chapterOrder,
    );

    let prevChapterLastTopic: CurriculumTopic | null = null;

    for (const [, chapterTopics] of sortedChapters) {
      // Sort topics within chapter by order
      chapterTopics.sort((a, b) => a.topicOrder - b.topicOrder);

      // Rule 1: linear ordering within chapter
      for (let i = 1; i < chapterTopics.length; i++) {
        addEdge(chapterTopics[i - 1].topicId, chapterTopics[i].topicId);
      }

      // Rule 2: last topic of previous chapter → first topic of this chapter
      if (prevChapterLastTopic && chapterTopics.length > 0) {
        addEdge(prevChapterLastTopic.topicId, chapterTopics[0].topicId);
      }

      prevChapterLastTopic = chapterTopics[chapterTopics.length - 1] ?? null;
    }
  }

  // Rule 3: parentId → child (sub-topic prerequisite)
  const topicById = new Map(topics.map((t) => [t.topicId, t]));
  for (const t of topics) {
    if (t.parentId && topicById.has(t.parentId)) {
      addEdge(t.parentId, t.topicId);
    }
  }

  const snapshot: CurriculumGraphSnapshot = {
    topics,
    prerequisites,
    dependents,
    builtAt: new Date().toISOString(),
  };

  logger.info('[CURRICULUM_GRAPH_BUILT]', {
    topicCount: topics.length,
    edgeCount: Object.values(prerequisites).reduce((sum, arr) => sum + arr.length, 0),
    builtAt: snapshot.builtAt,
  });

  return snapshot;
}

// ─── Cache Helpers ────────────────────────────────────────────────────────────

/** RISK-05: In-flight mutex — only one buildGraph at a time; others await. */
let inFlightBuild: Promise<CurriculumGraphSnapshot> | null = null;

async function loadFromCache(): Promise<CurriculumGraphSnapshot | null> {
  try {
    const redis = getRedis();
    const raw = await redis.get(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CurriculumGraphSnapshot;
  } catch (err) {
    logger.warn('[CURRICULUM_GRAPH_CACHE] read error', { error: String(err) });
    return null;
  }
}

async function storeInCache(snapshot: CurriculumGraphSnapshot): Promise<void> {
  try {
    const redis = getRedis();
    await redis.set(CACHE_KEY, JSON.stringify(snapshot), 'EX', CACHE_TTL_SECONDS);
    logger.debug('[CURRICULUM_GRAPH_CACHE] stored', { ttl: CACHE_TTL_SECONDS });
  } catch (err) {
    logger.warn('[CURRICULUM_GRAPH_CACHE] write error', { error: String(err) });
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Return the full curriculum graph snapshot, loading from Redis cache when
 * available and rebuilding from Prisma on a cache miss.
 *
 * RISK-05: In-flight mutex — if a build is already running, concurrent
 * requests await the same result instead of triggering parallel builds.
 */
export async function getCurriculumGraph(): Promise<CurriculumGraphSnapshot> {
  const cached = await loadFromCache();
  if (cached) {
    logger.debug('[CURRICULUM_GRAPH_CACHE] hit');
    return cached;
  }

  if (inFlightBuild) {
    logger.debug('[CURRICULUM_GRAPH_CACHE] awaiting in-flight build');
    return inFlightBuild;
  }

  inFlightBuild = (async () => {
    try {
      const snapshot = await buildGraph();
      await storeInCache(snapshot);
      return snapshot;
    } finally {
      inFlightBuild = null;
    }
  })();

  return inFlightBuild;
}

/**
 * Return the direct prerequisite topic IDs for `topicId`.
 * These are the topics a student should ideally complete before this one.
 */
export async function getPrerequisites(topicId: string): Promise<string[]> {
  const graph = await getCurriculumGraph();
  return graph.prerequisites[topicId] ?? [];
}

/**
 * Return the topic IDs that become available after completing `topicId`.
 */
export async function getDependents(topicId: string): Promise<string[]> {
  const graph = await getCurriculumGraph();
  return graph.dependents[topicId] ?? [];
}

/**
 * GAP-04: Get all transitive prerequisites for `topicId` via graph traversal.
 * Returns the set of topic IDs that must be mastered before this topic
 * (direct prerequisites plus their prerequisites, recursively).
 */
function getTransitivePrerequisites(
  topicId: string,
  graph: CurriculumGraphSnapshot,
): Set<string> {
  const result = new Set<string>();
  const queue: string[] = [...(graph.prerequisites[topicId] ?? [])];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    result.add(id);
    const directPrereqs = graph.prerequisites[id] ?? [];
    for (const p of directPrereqs) {
      if (!visited.has(p)) queue.push(p);
    }
  }
  return result;
}

/**
 * Check whether all prerequisites for `topicId` are satisfied by the
 * provided set of mastered topic IDs (mastery >= threshold).
 *
 * GAP-04: Uses transitive prerequisite check — deep prerequisite chains
 * are respected (e.g. A→B→C means A requires both B and C).
 */
export function arePrerequisitesMet(
  topicId: string,
  graph: CurriculumGraphSnapshot,
  masteredTopicIds: Set<string>,
): boolean {
  const transitivePrereqs = getTransitivePrerequisites(topicId, graph);
  return [...transitivePrereqs].every((prereqId) => masteredTopicIds.has(prereqId));
}

/**
 * Return all topic IDs that are unlocked for a student — meaning every one
 * of their prerequisites is in `completedTopicIds`.
 */
export function getUnlockedTopics(
  graph: CurriculumGraphSnapshot,
  completedTopicIds: Set<string>,
): string[] {
  return graph.topics
    .map((t) => t.topicId)
    .filter(
      (id) =>
        !completedTopicIds.has(id) &&
        arePrerequisitesMet(id, graph, completedTopicIds),
    );
}

/**
 * Return topics in curriculum order for the given subject IDs (or all subjects
 * if none provided).
 */
export function getCurriculumPath(
  graph: CurriculumGraphSnapshot,
  subjectIds?: string[],
): CurriculumTopic[] {
  if (!subjectIds || subjectIds.length === 0) return graph.topics;
  const idSet = new Set(subjectIds);
  return graph.topics.filter((t) => idSet.has(t.subjectId));
}

/**
 * Invalidate the cached curriculum graph.
 * Call after admin promotes/archives curriculum content.
 */
export async function invalidateCurriculumGraph(): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(CACHE_KEY);
    logger.info('[CURRICULUM_GRAPH_CACHE] invalidated');
  } catch (err) {
    logger.warn('[CURRICULUM_GRAPH_CACHE] invalidation error', { error: String(err) });
  }
}
