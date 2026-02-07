/**
 * FILE OBJECTIVE:
 * - Personalized recommendation engine that suggests content based on user profile,
 *   learning history, test performance, and engagement patterns.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/recommendations/engine.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-01 | claude  | added TopicNote/GeneratedTest sources, exclude completed, engagement history
 * - 2026-01-22 | copilot | created recommendation engine with multi-signal scoring
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Recommendation item with scoring metadata
 */
export interface RecommendationItem {
  id: string;
  contentId: string;
  type: 'lesson' | 'quiz' | 'practice' | 'notes' | 'video' | 'chapter' | 'test';
  title: string;
  subject: string;
  chapter?: string;
  difficulty?: string;
  score: number;
  reasoning: string[];
  meta?: Record<string, unknown>;
}

/**
 * User signals for recommendation scoring
 */
interface UserSignals {
  userId: string;
  board: string;
  grade: string;
  language: string;
  subjects: string[];
  weakSubjects: string[];
  recentTopics: string[];
  lowScoreChapters: string[];
  incompleteSessions: string[];
  completedContentIds: Set<string>;
  engagementPatterns: {
    preferredDifficulty: string;
    averageSessionDuration: number;
    activeHours: number[];
    typeCounts: Record<string, number>;
  };
  engagementByType: Record<string, {
    shown: number;
    clicked: number;
    completed: number;
    ignored: number;
  }>;
}

/**
 * Score weights for different recommendation signals
 */
const SCORE_WEIGHTS = {
  PROFILE_MATCH: 30,              // Matches user's board/grade/subjects
  WEAK_SUBJECT_BOOST: 25,         // Content in subjects user struggles with
  LOW_SCORE_CHAPTER: 20,          // Chapters where user scored poorly
  RECENT_TOPIC_RELEVANCE: 15,     // Related to recently studied topics
  INCOMPLETE_SESSION: 35,         // Resume incomplete learning
  DIFFICULTY_MATCH: 10,           // Matches preferred difficulty
  FRESHNESS: 5,                   // Newer content gets slight boost
  ENGAGEMENT_HISTORY: 10,         // Based on past engagement patterns
  PEER_POPULARITY: 5,             // Popular among similar users
  POSITIVE_ENGAGEMENT_BOOST: 15,  // High engagement with similar content type
  NEGATIVE_ENGAGEMENT_PENALTY: -20, // Frequently ignored content type
};

/**
 * Main recommendation engine class
 */
export class RecommendationEngine {
  private userId: string;
  private signals: UserSignals | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Generate personalized recommendations for the user
   */
  async getRecommendations(limit: number = 10): Promise<RecommendationItem[]> {
    try {
      // 1. Gather user signals
      this.signals = await this.gatherUserSignals();
      
      // 2. Get candidate content
      const candidates = await this.getCandidateContent();
      
      // 3. Filter out completed content
      const completedIds = this.signals.completedContentIds;
      const filtered = candidates.filter(c => !completedIds.has(c.contentId));

      // 4. Score each candidate
      const scored = filtered.map(c => this.scoreCandidate(c));

      // 5. Sort by score and deduplicate
      const sorted = this.deduplicateAndSort(scored);
      
      // 6. Return top N
      return sorted.slice(0, limit);
    } catch (error) {
      logger.error('RecommendationEngine.getRecommendations', { 
        userId: this.userId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return [];
    }
  }

  /**
   * Gather all user signals for recommendation scoring
   */
  private async gatherUserSignals(): Promise<UserSignals> {
    const [user, profile, testResults, sessions, completedRecs, engagementHistory] = await Promise.all([
      prisma.user.findUnique({
        where: { id: this.userId },
        select: { board: true, grade: true, language: true, subjects: true }
      }),
      prisma.studentLearningProfile.findUnique({
        where: { studentId: this.userId },
        select: { weakSubjects: true, recommendations: true }
      }),
      prisma.testResult.findMany({
        where: { studentId: this.userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          AttemptQuestions: {
            include: {
              question: { select: { subject: true, chapter: true } },
              answer: { select: { autoScore: true } }
            }
          }
        }
      }),
      prisma.learningSession.findMany({
        where: { studentId: this.userId },
        orderBy: { lastAccessed: 'desc' },
        take: 30,
        select: {
          activityType: true,
          activityRef: true,
          isCompleted: true,
          completionPercentage: true,
          difficultyLevel: true,
          actualTimeSpent: true,
          startedAt: true,
          meta: true
        }
      }),
      prisma.contentRecommendation.findMany({
        where: { userId: this.userId, isCompleted: true },
        select: { contentId: true }
      }),
      // NEW: Get engagement history for feedback loop
      prisma.contentRecommendation.findMany({
        where: { userId: this.userId },
        select: {
          contentId: true,
          isShown: true,
          isClicked: true,
          isCompleted: true,
          isIgnored: true,
        }
      })
    ]);

    // Analyze test performance to find weak areas
    const chapterScores: Record<string, { total: number; correct: number }> = {};
    for (const result of testResults) {
      for (const aq of result.AttemptQuestions) {
        const chapter = aq.question?.chapter || 'unknown';
        if (!chapterScores[chapter]) {
          chapterScores[chapter] = { total: 0, correct: 0 };
        }
        chapterScores[chapter].total++;
        if (aq.answer?.autoScore && aq.answer.autoScore > 0) {
          chapterScores[chapter].correct++;
        }
      }
    }
    
    // Find chapters with < 60% accuracy
    const lowScoreChapters = Object.entries(chapterScores)
      .filter(([, stats]) => stats.total >= 3 && (stats.correct / stats.total) < 0.6)
      .map(([chapter]) => chapter);

    // Find recent topics from sessions
    const recentTopics = sessions
      .filter(s => s.meta && typeof s.meta === 'object')
      .slice(0, 10)
      .map(s => {
        const meta = s.meta as Record<string, unknown>;
        return (meta.topic as string) || (meta.chapter as string) || '';
      })
      .filter(Boolean);

    // Find incomplete sessions
    const incompleteSessions = sessions
      .filter(s => !s.isCompleted && s.completionPercentage < 80)
      .map(s => s.activityRef || '')
      .filter(Boolean);

    // Calculate engagement patterns
    const difficulties = sessions.map(s => s.difficultyLevel).filter(Boolean);
    const preferredDifficulty = this.getMostCommon(difficulties) || 'MEDIUM';
    
    const sessionDurations = sessions.map(s => s.actualTimeSpent).filter(Boolean);
    const averageSessionDuration = sessionDurations.length > 0
      ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
      : 15;

    const sessionHours = sessions.map(s => new Date(s.startedAt).getHours());
    const activeHours = [...new Set(sessionHours)].slice(0, 5) as number[];

    // Build set of completed content IDs for exclusion
    const completedContentIds = new Set<string>(completedRecs.map(r => String(r.contentId)));

    // Count engagement by activity type for ENGAGEMENT_HISTORY scoring
    const typeCounts: Record<string, number> = {};
    for (const s of sessions) {
      const t = s.activityType?.toLowerCase() || 'other';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }

    // NEW: Calculate engagement metrics by content type for feedback loop
    const engagementByType: Record<string, { shown: number; clicked: number; completed: number; ignored: number }> = {};
    for (const rec of engagementHistory) {
      // Extract content type from contentId (format: "type:id" or just "id")
      const type = rec.contentId.includes(':') ? rec.contentId.split(':')[0] : 'catalog';
      if (!engagementByType[type]) {
        engagementByType[type] = { shown: 0, clicked: 0, completed: 0, ignored: 0 };
      }
      if (rec.isShown) engagementByType[type].shown++;
      if (rec.isClicked) engagementByType[type].clicked++;
      if (rec.isCompleted) engagementByType[type].completed++;
      if (rec.isIgnored) engagementByType[type].ignored++;
    }

    return {
      userId: this.userId,
      board: user?.board || '',
      grade: user?.grade || '',
      language: user?.language || 'en',
      subjects: (user?.subjects || []) as string[],
      weakSubjects: (profile?.weakSubjects || []) as string[],
      recentTopics,
      lowScoreChapters,
      incompleteSessions,
      completedContentIds,
      engagementPatterns: {
        preferredDifficulty: String(preferredDifficulty || 'MEDIUM'),
        averageSessionDuration,
        activeHours,
        typeCounts
      },
      engagementByType
    };
  }

  /**
   * Get candidate content items for recommendation
   */
  private async getCandidateContent(): Promise<CandidateContent[]> {
    if (!this.signals) return [];

    const { board, grade, subjects, language } = this.signals;
    const hasSubjects = subjects && subjects.length > 0;

    // Get content from multiple sources including hydrated content
    const [catalogItems, chapters, questions, notes, topicNotes, generatedTests] = await Promise.all([
      // ContentCatalog items
      prisma.contentCatalog.findMany({
        where: {
          active: true,
          OR: [
            { board, grade },
            hasSubjects ? { subject: { in: subjects } } : {},
            { language }
          ]
        },
        take: 100,
        orderBy: { updatedAt: 'desc' }
      }),

      // ChapterDef items (lessons/chapters)
      prisma.chapterDef.findMany({
        where: {
          lifecycle: 'active',
          ...(hasSubjects ? { subject: { name: { in: subjects } } } : {})
        },
        take: 50,
        include: { subject: { select: { name: true, classId: true } } }
      }),

      // Questions for practice
      prisma.question.findMany({
        where: {
          OR: [
            { board, grade },
            hasSubjects ? { subject: { in: subjects } } : {}
          ]
        },
        take: 50,
        orderBy: { updatedAt: 'desc' }
      }),

      // Public user-created notes
      prisma.note.findMany({
        where: {
          isPublic: true,
          subject: subjects.length ? { in: subjects } : undefined
        },
        take: 30,
        orderBy: { createdAt: 'desc' }
      }),

      // Hydrated TopicNotes (approved, active)
      prisma.topicNote.findMany({
        where: {
          status: 'approved',
          lifecycle: 'active',
          language: language as any,
          ...(hasSubjects ? { topic: { chapter: { subject: { name: { in: subjects } } } } } : {})
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          topic: {
            select: {
              id: true,
              name: true,
              slug: true,
              chapter: {
                select: {
                  name: true,
                  slug: true,
                  subject: { select: { name: true } }
                }
              }
            }
          }
        }
      }),

      // Hydrated GeneratedTests (approved, active)
      prisma.generatedTest.findMany({
        where: {
          status: 'approved',
          lifecycle: 'active',
          language: language as any,
          ...(hasSubjects ? { topic: { chapter: { subject: { name: { in: subjects } } } } } : {})
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          topic: {
            select: {
              id: true,
              name: true,
              chapter: {
                select: {
                  name: true,
                  slug: true,
                  subject: { select: { name: true } }
                }
              }
            }
          },
          questions: { select: { id: true } }
        }
      })
    ]);

    const candidates: CandidateContent[] = [];

    // Transform catalog items
    for (const item of catalogItems) {
      candidates.push({
        id: item.id,
        contentId: item.contentId,
        type: (item.type as RecommendationItem['type']) || 'lesson',
        title: item.title,
        subject: item.subject,
        board: item.board,
        grade: item.grade,
        difficulty: item.difficulty || undefined,
        tags: item.tags,
        createdAt: item.createdAt,
        source: 'catalog'
      });
    }

    // Transform chapters
    for (const chapter of chapters) {
      candidates.push({
        id: chapter.id,
        contentId: `chapter:${chapter.id}`,
        type: 'chapter',
        title: chapter.name,
        subject: chapter.subject?.name || '',
        board: board,
        grade: grade,
        chapter: chapter.slug,
        createdAt: chapter.createdAt,
        source: 'chapter'
      });
    }

    // Transform questions as practice recommendations
    const questionGroups = this.groupBy(questions, 'chapter');
    for (const [chapterKey, qs] of Object.entries(questionGroups)) {
      if (qs.length >= 3) {
        const firstQ = qs[0] as { subject?: string | null; board?: string | null; grade?: string | null; difficulty?: string | null } | undefined;
        candidates.push({
          id: `practice:${chapterKey}`,
          contentId: `practice:${chapterKey}`,
          type: 'practice',
          title: `Practice: ${chapterKey || 'Mixed Topics'}`,
          subject: String(firstQ?.subject || ''),
          board: String(firstQ?.board || ''),
          grade: String(firstQ?.grade || ''),
          chapter: chapterKey || undefined,
          difficulty: firstQ?.difficulty ? String(firstQ.difficulty) : undefined,
          createdAt: new Date(),
          source: 'question',
          meta: { questionCount: qs.length }
        });
      }
    }

    // Transform user-created notes
    for (const note of notes) {
      candidates.push({
        id: note.id,
        contentId: `note:${note.id}`,
        type: 'notes',
        title: note.title,
        subject: note.subject || '',
        board: board,
        grade: grade,
        createdAt: note.createdAt,
        source: 'note'
      });
    }

    // Transform hydrated TopicNotes
    for (const tn of topicNotes) {
      const subjectName = tn.topic?.chapter?.subject?.name || '';
      candidates.push({
        id: tn.id,
        contentId: `topicNote:${tn.id}`,
        type: 'notes',
        title: tn.title,
        subject: subjectName,
        board: board,
        grade: grade,
        chapter: tn.topic?.chapter?.slug,
        createdAt: tn.createdAt,
        source: 'topicNote',
        meta: {
          topicId: tn.topic?.id,
          topicName: tn.topic?.name,
          chapterName: tn.topic?.chapter?.name
        }
      });
    }

    // Transform hydrated GeneratedTests
    for (const gt of generatedTests) {
      const subjectName = gt.topic?.chapter?.subject?.name || '';
      candidates.push({
        id: gt.id,
        contentId: `generatedTest:${gt.id}`,
        type: 'test',
        title: gt.title,
        subject: subjectName,
        board: board,
        grade: grade,
        chapter: gt.topic?.chapter?.slug,
        difficulty: gt.difficulty,
        createdAt: gt.createdAt,
        source: 'generatedTest',
        meta: {
          topicId: gt.topic?.id,
          topicName: gt.topic?.name,
          chapterName: gt.topic?.chapter?.name,
          questionCount: gt.questions.length,
          difficulty: gt.difficulty
        }
      });
    }

    return candidates;
  }

  /**
   * Score a candidate content item
   */
  private scoreCandidate(candidate: CandidateContent): RecommendationItem {
    if (!this.signals) {
      return this.toRecommendationItem(candidate, 0, ['No signals available']);
    }

    let score = 0;
    const reasons: string[] = [];

    // 1. Profile match (board/grade/subjects)
    if (candidate.board === this.signals.board && candidate.grade === this.signals.grade) {
      score += SCORE_WEIGHTS.PROFILE_MATCH;
      reasons.push('Matches your board and grade');
    } else if (candidate.board === this.signals.board || candidate.grade === this.signals.grade) {
      score += SCORE_WEIGHTS.PROFILE_MATCH * 0.5;
    }

    // 2. Subject relevance
    if (this.signals.subjects.includes(candidate.subject)) {
      score += 15;
      reasons.push(`In your ${candidate.subject} curriculum`);
    }

    // 3. Weak subject boost
    if (this.signals.weakSubjects.includes(candidate.subject)) {
      score += SCORE_WEIGHTS.WEAK_SUBJECT_BOOST;
      reasons.push('Helps strengthen a weak area');
    }

    // 4. Low score chapter boost
    if (candidate.chapter && this.signals.lowScoreChapters.includes(candidate.chapter)) {
      score += SCORE_WEIGHTS.LOW_SCORE_CHAPTER;
      reasons.push('Review recommended based on test performance');
    }

    // 5. Recent topic relevance
    if (candidate.chapter && this.signals.recentTopics.includes(candidate.chapter)) {
      score += SCORE_WEIGHTS.RECENT_TOPIC_RELEVANCE;
      reasons.push('Related to your recent studies');
    }

    // 6. Incomplete session (highest priority)
    if (this.signals.incompleteSessions.includes(candidate.contentId)) {
      score += SCORE_WEIGHTS.INCOMPLETE_SESSION;
      reasons.push('Continue where you left off');
    }

    // 7. Difficulty match
    const candidateDifficulty = candidate.difficulty?.toUpperCase() || 'MEDIUM';
    if (candidateDifficulty === this.signals.engagementPatterns.preferredDifficulty) {
      score += SCORE_WEIGHTS.DIFFICULTY_MATCH;
    }

    // 8. Freshness bonus (content created in last 30 days)
    const daysSinceCreation = (Date.now() - candidate.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 30) {
      score += SCORE_WEIGHTS.FRESHNESS;
      if (daysSinceCreation < 7) {
        reasons.push('New content');
      }
    }

    // 9. Type-specific boosts
    if (candidate.type === 'practice' && score > 30) {
      score += 5; // Boost practice for struggling areas
    }

    // 10. Engagement history: boost content types user engages with most
    const typeCounts = this.signals.engagementPatterns.typeCounts;
    const candidateActivityType = candidate.type === 'test' ? 'test' : candidate.type === 'notes' ? 'notes' : candidate.type;
    if (typeCounts[candidateActivityType] && typeCounts[candidateActivityType] >= 3) {
      score += SCORE_WEIGHTS.ENGAGEMENT_HISTORY;
      reasons.push('Matches your learning preferences');
    }

    // 11. NEW: Engagement-based feedback loop adjustments
    const candidateSource = candidate.source;
    const engagement = this.signals.engagementByType[candidateSource];

    if (engagement && engagement.shown > 0) {
      const clickThroughRate = engagement.clicked / engagement.shown;
      const completionRate = engagement.completed / engagement.shown;
      const ignoreRate = engagement.ignored / engagement.shown;

      // Boost if high engagement with this content type
      if (engagement.shown >= 5 && clickThroughRate > 0.5) {
        score += SCORE_WEIGHTS.POSITIVE_ENGAGEMENT_BOOST;
        reasons.push('You engage well with this content type');
      }

      // Boost if high completion rate
      if (engagement.clicked >= 3 && completionRate > 0.6) {
        score += Math.round(SCORE_WEIGHTS.POSITIVE_ENGAGEMENT_BOOST * 0.5);
        reasons.push('High completion rate for this type');
      }

      // Penalize if frequently ignored
      if (engagement.shown >= 5 && ignoreRate > 0.3) {
        score += SCORE_WEIGHTS.NEGATIVE_ENGAGEMENT_PENALTY;
        // Don't add negative reason to avoid discouraging users
      }
    }

    // Ensure minimum reasoning
    if (reasons.length === 0) {
      reasons.push('Recommended for your learning journey');
    }

    return this.toRecommendationItem(candidate, score, reasons);
  }

  /**
   * Convert candidate to recommendation item
   */
  private toRecommendationItem(
    candidate: CandidateContent, 
    score: number, 
    reasoning: string[]
  ): RecommendationItem {
    return {
      id: candidate.id,
      contentId: candidate.contentId,
      type: candidate.type,
      title: candidate.title,
      subject: candidate.subject,
      chapter: candidate.chapter,
      difficulty: candidate.difficulty,
      score,
      reasoning,
      meta: candidate.meta
    };
  }

  /**
   * Deduplicate and sort recommendations
   */
  private deduplicateAndSort(items: RecommendationItem[]): RecommendationItem[] {
    // Deduplicate by contentId
    const seen = new Set<string>();
    const unique = items.filter(item => {
      if (seen.has(item.contentId)) return false;
      seen.add(item.contentId);
      return true;
    });

    // Sort by score descending
    return unique.sort((a, b) => b.score - a.score);
  }

  /**
   * Helper: Get most common value from array
   */
  private getMostCommon<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined;
    const counts = new Map<T, number>();
    for (const item of arr) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    let maxCount = 0;
    let maxItem: T | undefined;
    for (const [item, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        maxItem = item;
      }
    }
    return maxItem;
  }

  /**
   * Helper: Group array by key
   */
  private groupBy<T extends Record<string, unknown>>(arr: T[], key: string): Record<string, T[]> {
    return arr.reduce((acc, item) => {
      const k = String(item[key] || 'unknown');
      acc[k] = acc[k] || [];
      acc[k].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }
}

/**
 * Internal type for candidate content
 */
interface CandidateContent {
  id: string;
  contentId: string;
  type: RecommendationItem['type'];
  title: string;
  subject: string;
  board?: string;
  grade?: string;
  chapter?: string;
  difficulty?: string;
  tags?: string[];
  createdAt: Date;
  source: 'catalog' | 'chapter' | 'question' | 'note' | 'topicNote' | 'generatedTest';
  meta?: Record<string, unknown>;
}

/**
 * Factory function to get recommendations for a user
 */
export async function getRecommendationsForUser(
  userId: string, 
  limit: number = 10
): Promise<RecommendationItem[]> {
  const engine = new RecommendationEngine(userId);
  return engine.getRecommendations(limit);
}

/**
 * Update user's learning profile based on recent activity
 * Call this after test completion or session end
 */
export async function updateLearningProfile(userId: string): Promise<void> {
  try {
    // Get recent test performance
    const testResults = await prisma.testResult.findMany({
      where: { studentId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        AttemptQuestions: {
          include: {
            question: { select: { subject: true, chapter: true } },
            answer: { select: { autoScore: true } }
          }
        }
      }
    });

    // Analyze weak subjects
    const subjectScores: Record<string, { total: number; correct: number }> = {};
    for (const result of testResults) {
      for (const aq of result.AttemptQuestions) {
        const subject = aq.question?.subject || 'unknown';
        if (!subjectScores[subject]) {
          subjectScores[subject] = { total: 0, correct: 0 };
        }
        subjectScores[subject].total++;
        if (aq.answer?.autoScore && aq.answer.autoScore > 0) {
          subjectScores[subject].correct++;
        }
      }
    }

    // Find weak subjects (< 60% accuracy with minimum 5 questions)
    const weakSubjects = Object.entries(subjectScores)
      .filter(([, stats]) => stats.total >= 5 && (stats.correct / stats.total) < 0.6)
      .map(([subject]) => subject);

    // Find strengths (> 80% accuracy)
    const strengths = Object.entries(subjectScores)
      .filter(([, stats]) => stats.total >= 5 && (stats.correct / stats.total) >= 0.8)
      .map(([subject, stats]) => ({
        subject,
        accuracy: Math.round((stats.correct / stats.total) * 100)
      }));

    // Upsert learning profile
    await prisma.studentLearningProfile.upsert({
      where: { studentId: userId },
      update: {
        weakSubjects,
        strengths,
        updatedAt: new Date()
      },
      create: {
        studentId: userId,
        weakSubjects,
        strengths
      }
    });

    logger.info('RecommendationEngine.updateLearningProfile', { 
      userId, 
      weakSubjects, 
      strengthCount: strengths.length 
    });
  } catch (error) {
    logger.error('RecommendationEngine.updateLearningProfile', { 
      userId, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

export default RecommendationEngine;
