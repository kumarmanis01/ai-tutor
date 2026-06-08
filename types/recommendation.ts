/**
 * FILE OBJECTIVE:
 * - Type definitions for the personalized recommendation engine:
 *   context builder inputs, recommendation shape, and API result.
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | initial: recommendation types for Phase 5 engine
 */

export type RecommendationType =
  | 'topic_review'     // revisit a weak area
  | 'practice_test'    // take a test on a topic
  | 'new_concept'      // progress to the next concept
  | 'doubt_clearance'; // ask a specific doubt

export interface WeakTopic {
  topic: string;
  masteryScore: number; // 0.0 - 1.0
  lastAttemptedAt: Date;
}

export interface RecommendationContext {
  userId: string;
  grade?: string;
  board?: string;
  /** Last 5 unique Chat.subject values ordered by recency. */
  recentChatTopics: string[];
  /** UserTopicProgress rows where masteryScore < 0.6, ordered asc. */
  weakTopics: WeakTopic[];
  /** Score from the most recent TestResult for this user. */
  lastTestScore?: number;
  /** Days since the latest Chat or TestResult activity. */
  daysSinceLastActivity: number;
  totalTestsAttempted: number;
}

export interface Recommendation {
  /** Deterministic identifier: hash of (userId + type + topic). */
  id: string;
  type: RecommendationType;
  /** Student-facing headline; max 6 words. */
  title: string;
  /** Pre-filled question for QuickInputBox; max 20 words. */
  prompt: string;
  /** Evidence sentence shown as subtitle, e.g. "You got 40% on Algebra last week." */
  reason: string;
  /** Sorting weight; 0.0 - 1.0. */
  relevanceScore: number;
  /** Curriculum topic this recommendation targets, if applicable. */
  topic?: string;
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  context: Pick<RecommendationContext, 'weakTopics' | 'lastTestScore'>;
  cached: boolean;
  generatedAt: string; // ISO timestamp
}
