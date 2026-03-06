/**
 * FILE OBJECTIVE:
 * - Personalized recommendation engine that suggests content based on user profile,
 *   learning history, test performance, and engagement patterns.
 * - Topic-first design: all recommendations anchor on topicId as the primary unit.
 * - Canonical content identity: IDs normalize to {type}:{topicId} for consistent matching.
 * - Type-balanced diversity: guarantees a mix of content types in every recommendation set.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/recommendations/engine.spec.ts
 *
 * EDIT LOG:
 * - 2026-03-03 | claude  | architectural fix: identity normalization, engagement mapping, diversity, topic-first, observability
 * - 2026-02-01 | claude  | added TopicNote/GeneratedTest sources, exclude completed, engagement history
 * - 2026-01-22 | copilot | created recommendation engine with multi-signal scoring
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ─── Canonical Content Identity (Prompt 1) ───────────────────────────────────

/**
 * Normalize a candidate's content ID to canonical format: {type}:{topicId}.
 * Falls back to original contentId when topicId is unavailable.
 */
export function normalizeContentId(item: { type: string; contentId: string; meta?: Record<string, unknown> }): string {
  const topicId = item.meta?.topicId as string | undefined;
  if (!topicId) return item.contentId;

  const t = item.type?.toLowerCase();
  if (t === 'notes' || t === 'note') return `notes:${topicId}`;
  if (t === 'test' || t === 'quiz') return `test:${topicId}`;
  if (t === 'practice') return `practice:${topicId}`;
  if (t === 'lesson' || t === 'chapter') return `lesson:${topicId}`;
  return `topic:${topicId}`;
}

/**
 * Extract a topicId from a learning session's activity reference and metadata.
 * Used to normalize incomplete-session signals to topicId for matching.
 */
function extractSessionTopicId(activityRef: string | null, meta: Record<string, unknown> | null): string | null {
  const m = meta ?? {};
  if (typeof m.topicId === 'string' && m.topicId) return m.topicId;
  if (typeof m.topic === 'string' && m.topic) return m.topic;
  if (!activityRef) return null;
  if (activityRef.includes(':')) return activityRef.split(':')[1] || null;
  return activityRef;
}

// ─── Engagement Type Mapping (Prompt 2) ──────────────────────────────────────

const SOURCE_TO_ENGAGEMENT_TYPE: Record<string, string> = {
  question: 'practice',
  generatedTest: 'test',
  topicNote: 'notes',
  note: 'notes',
  chapter: 'lesson',
  catalog: 'lesson',
};

/**
 * Map a candidate source (internal label from candidate construction)
 * to the engagement type namespace used in contentRecommendation tracking.
 */
export function mapSourceToEngagementType(source: string): string {
  return SOURCE_TO_ENGAGEMENT_TYPE[source] || source;
}

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface UserSignals {
  userId: string;
  board: string;
  grade: string;
  language: string;
  subjects: string[];
  weakSubjects: string[];
  recentTopicIds: string[];
  lowScoreChapters: string[];
  lowScoreTopicIds: string[];
  weakSubjectTopicIds: string[];
  incompleteTopicIds: Set<string>;
  completedContentIds: Set<string>;
  completedTopicIds: Set<string>;
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
  topicId?: string;
  meta?: Record<string, unknown>;
}

// ─── Score Weights ───────────────────────────────────────────────────────────

const SCORE_WEIGHTS = {
  PROFILE_MATCH: 30,
  WEAK_SUBJECT_BOOST: 25,
  LOW_SCORE_CHAPTER: 20,
  RECENT_TOPIC_RELEVANCE: 15,
  RESUME_SESSION: 50,
  DIFFICULTY_MATCH: 10,
  FRESHNESS: 5,
  ENGAGEMENT_HISTORY: 10,
  POSITIVE_ENGAGEMENT_BOOST: 15,
  NEGATIVE_ENGAGEMENT_PENALTY: -20,
};

// ─── Diversity Config (Prompt 4) ─────────────────────────────────────────────

const MAX_PER_TYPE = 2;
const DIVERSITY_SLOTS: RecommendationItem['type'][] = ['lesson', 'practice', 'notes', 'test'];

// ─── Engine ──────────────────────────────────────────────────────────────────

export class RecommendationEngine {
  private userId: string;
  private signals: UserSignals | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  async getRecommendations(limit: number = 10): Promise<RecommendationItem[]> {
    try {
      this.signals = await this.gatherUserSignals();
      const candidates = await this.getCandidateContent();

      const filtered = candidates.filter(c => {
        const nId = normalizeContentId(c);
        if (this.signals!.completedContentIds.has(nId)) return false;
        if (this.signals!.completedContentIds.has(c.contentId)) return false;
        if (c.topicId && this.signals!.completedTopicIds.has(c.topicId)) return false;
        return true;
      });

      const scored = filtered.map(c => this.scoreCandidate(c));
      return this.diversifyAndSort(scored, limit);
    } catch (error) {
      logger.error('RecommendationEngine.getRecommendations', {
        userId: this.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // ── Signal Gathering (Prompt 3 — topic-first signals) ──────────────────

  private async gatherUserSignals(): Promise<UserSignals> {
    const [user, profile, testResults, sessions, completedRecs, engagementHistory] = await Promise.all([
      prisma.user.findUnique({
        where: { id: this.userId },
        select: { board: true, grade: true, language: true, subjects: true },
      }),
      prisma.studentLearningProfile.findUnique({
        where: { studentId: this.userId },
        select: { weakSubjects: true, recommendations: true },
      }),
      prisma.testResult.findMany({
        where: { studentId: this.userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          AttemptQuestions: {
            include: {
              question: { select: { subject: true, chapter: true } },
              answer: { select: { autoScore: true } },
            },
          },
        },
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
          meta: true,
        },
      }),
      prisma.contentRecommendation.findMany({
        where: { userId: this.userId, isCompleted: true },
        select: { contentId: true },
      }),
      prisma.contentRecommendation.findMany({
        where: { userId: this.userId },
        select: {
          contentId: true,
          isShown: true,
          isClicked: true,
          isCompleted: true,
          isIgnored: true,
        },
      }),
    ]);

    // ── Test performance → low-score chapters ──
    const chapterScores: Record<string, { total: number; correct: number }> = {};
    for (const result of testResults) {
      for (const aq of result.AttemptQuestions) {
        const chapter = aq.question?.chapter || 'unknown';
        if (!chapterScores[chapter]) chapterScores[chapter] = { total: 0, correct: 0 };
        chapterScores[chapter].total++;
        if (aq.answer?.autoScore && aq.answer.autoScore > 0) chapterScores[chapter].correct++;
      }
    }
    const lowScoreChapters = Object.entries(chapterScores)
      .filter(([, s]) => s.total >= 3 && s.correct / s.total < 0.6)
      .map(([ch]) => ch);

    // ── Recent topicIds from sessions (Prompt 3) ──
    const recentTopicIds: string[] = [];
    for (const s of sessions.slice(0, 10)) {
      const meta = s.meta && typeof s.meta === 'object' ? (s.meta as Record<string, unknown>) : {};
      const tid = extractSessionTopicId(s.activityRef, meta);
      if (tid && !recentTopicIds.includes(tid)) recentTopicIds.push(tid);
    }

    // ── Incomplete sessions → topicIds (Prompt 5) ──
    const incompleteTopicIds = new Set<string>();
    for (const s of sessions) {
      if (s.isCompleted || (s.completionPercentage ?? 0) >= 80) continue;
      const meta = s.meta && typeof s.meta === 'object' ? (s.meta as Record<string, unknown>) : {};
      const tid = extractSessionTopicId(s.activityRef, meta);
      if (tid) incompleteTopicIds.add(tid);
    }

    // ── Derive topicIds from low-score chapters and weak subjects ──
    const weakSubjects = (profile?.weakSubjects || []) as string[];
    const [lowScoreChapterDefs, weakSubjectTopics] = await Promise.all([
      lowScoreChapters.length > 0
        ? prisma.chapterDef.findMany({
            where: { slug: { in: lowScoreChapters } },
            select: { topics: { select: { id: true } } },
          })
        : [],
      weakSubjects.length > 0
        ? prisma.topicDef.findMany({
            where: { chapter: { subject: { name: { in: weakSubjects } } } },
            select: { id: true },
            take: 100,
          })
        : [],
    ]);
    const lowScoreTopicIds = lowScoreChapterDefs.flatMap(c => c.topics.map(t => t.id));
    const weakSubjectTopicIds = weakSubjectTopics.map(t => t.id);

    // ── Engagement patterns ──
    const difficulties = sessions.map(s => s.difficultyLevel).filter(Boolean);
    const preferredDifficulty = this.getMostCommon(difficulties) || 'MEDIUM';
    const sessionDurations = sessions.map(s => s.actualTimeSpent).filter(Boolean);
    const averageSessionDuration =
      sessionDurations.length > 0
        ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
        : 15;
    const sessionHours = sessions.map(s => new Date(s.startedAt).getHours());
    const activeHours = [...new Set(sessionHours)].slice(0, 5) as number[];
    const typeCounts: Record<string, number> = {};
    for (const s of sessions) {
      const t = s.activityType?.toLowerCase() || 'other';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }

    // ── Completed content (both raw and normalized) ──
    const completedContentIds = new Set<string>(completedRecs.map(r => String(r.contentId)));
    const completedTopicIds = new Set<string>();
    for (const r of completedRecs) {
      const cid = String(r.contentId);
      if (cid.includes(':')) {
        const tid = cid.split(':')[1];
        if (tid) completedTopicIds.add(tid);
      }
    }

    // ── Engagement by type (Prompt 2 — mapped keys) ──
    const engagementByType: Record<string, { shown: number; clicked: number; completed: number; ignored: number }> = {};
    for (const rec of engagementHistory) {
      const rawPrefix = rec.contentId.includes(':') ? rec.contentId.split(':')[0] : 'catalog';
      const mapped = SOURCE_TO_ENGAGEMENT_TYPE[rawPrefix] || rawPrefix;
      if (!engagementByType[mapped]) {
        engagementByType[mapped] = { shown: 0, clicked: 0, completed: 0, ignored: 0 };
      }
      if (rec.isShown) engagementByType[mapped].shown++;
      if (rec.isClicked) engagementByType[mapped].clicked++;
      if (rec.isCompleted) engagementByType[mapped].completed++;
      if (rec.isIgnored) engagementByType[mapped].ignored++;
    }

    return {
      userId: this.userId,
      board: user?.board || '',
      grade: user?.grade || '',
      language: user?.language || 'en',
      subjects: (user?.subjects || []) as string[],
      weakSubjects,
      recentTopicIds,
      lowScoreChapters,
      lowScoreTopicIds,
      weakSubjectTopicIds,
      incompleteTopicIds,
      completedContentIds,
      completedTopicIds,
      engagementPatterns: {
        preferredDifficulty: String(preferredDifficulty || 'MEDIUM'),
        averageSessionDuration,
        activeHours,
        typeCounts,
      },
      engagementByType,
    };
  }

  // ── Candidate Construction (Prompt 3 — always populate meta) ───────────

  private async getCandidateContent(): Promise<CandidateContent[]> {
    if (!this.signals) return [];

    const { board, grade, subjects, language } = this.signals;
    const hasSubjects = subjects && subjects.length > 0;

    const [catalogItems, chapters, questions, notes, topicNotes, generatedTests] = await Promise.all([
      prisma.contentCatalog.findMany({
        where: {
          active: true,
          OR: [{ board, grade }, hasSubjects ? { subject: { in: subjects } } : {}, { language }],
        },
        take: 100,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.chapterDef.findMany({
        where: {
          lifecycle: 'active',
          ...(hasSubjects ? { subject: { name: { in: subjects } } } : {}),
        },
        take: 50,
        include: {
          subject: { select: { id: true, name: true, classId: true } },
          topics: { select: { id: true, name: true }, take: 1, orderBy: { order: 'asc' } },
        },
      }),
      prisma.question.findMany({
        where: {
          OR: [{ board, grade }, hasSubjects ? { subject: { in: subjects } } : {}],
        },
        take: 50,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.note.findMany({
        where: {
          isPublic: true,
          subject: subjects.length ? { in: subjects } : undefined,
        },
        take: 30,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.topicNote.findMany({
        where: {
          status: 'approved',
          lifecycle: 'active',
          language: language as any,
          ...(hasSubjects ? { topic: { chapter: { subject: { name: { in: subjects } } } } } : {}),
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
                  id: true,
                  name: true,
                  slug: true,
                  subject: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.generatedTest.findMany({
        where: {
          status: 'approved',
          lifecycle: 'active',
          language: language as any,
          ...(hasSubjects ? { topic: { chapter: { subject: { name: { in: subjects } } } } } : {}),
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
                  id: true,
                  name: true,
                  slug: true,
                  subject: { select: { id: true, name: true } },
                },
              },
            },
          },
          questions: { select: { id: true } },
        },
      }),
    ]);

    const candidates: CandidateContent[] = [];

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
        source: 'catalog',
        meta: {},
      });
    }

    for (const chapter of chapters) {
      const firstTopic = chapter.topics?.[0];
      const topicId = firstTopic?.id;
      candidates.push({
        id: chapter.id,
        contentId: topicId ? `lesson:${topicId}` : `lesson:${chapter.id}`,
        type: 'lesson',
        title: chapter.name,
        subject: chapter.subject?.name || '',
        board,
        grade,
        chapter: chapter.slug,
        createdAt: chapter.createdAt,
        source: 'chapter',
        topicId,
        meta: {
          topicId,
          topicName: firstTopic?.name,
          chapterId: chapter.id,
          chapterName: chapter.name,
          subjectId: chapter.subject?.id,
          subjectName: chapter.subject?.name,
        },
      });
    }

    const questionGroups = this.groupBy(questions, 'chapter');
    for (const [chapterKey, qs] of Object.entries(questionGroups)) {
      if (qs.length >= 3) {
        const firstQ = qs[0] as Record<string, any>;
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
          meta: { questionCount: qs.length },
        });
      }
    }

    for (const note of notes) {
      candidates.push({
        id: note.id,
        contentId: `note:${note.id}`,
        type: 'notes',
        title: note.title,
        subject: note.subject || '',
        board,
        grade,
        createdAt: note.createdAt,
        source: 'note',
        meta: {},
      });
    }

    for (const tn of topicNotes) {
      const topicId = tn.topic?.id;
      const chapterId = (tn.topic?.chapter as any)?.id;
      const subjectId = (tn.topic?.chapter?.subject as any)?.id;
      const subjectName = tn.topic?.chapter?.subject?.name || '';

      candidates.push({
        id: tn.id,
        contentId: topicId ? `notes:${topicId}` : `topicNote:${tn.id}`,
        type: 'notes',
        title: tn.title,
        subject: subjectName,
        board,
        grade,
        chapter: tn.topic?.chapter?.slug,
        createdAt: tn.createdAt,
        source: 'topicNote',
        topicId,
        meta: {
          topicId,
          topicName: tn.topic?.name,
          chapterId,
          chapterName: tn.topic?.chapter?.name,
          subjectId,
          subjectName,
        },
      });
    }

    for (const gt of generatedTests) {
      const topicId = gt.topic?.id;
      const chapterId = (gt.topic?.chapter as any)?.id;
      const subjectId = (gt.topic?.chapter?.subject as any)?.id;
      const subjectName = gt.topic?.chapter?.subject?.name || '';

      candidates.push({
        id: gt.id,
        contentId: topicId ? `test:${topicId}` : `generatedTest:${gt.id}`,
        type: 'test',
        title: gt.title,
        subject: subjectName,
        board,
        grade,
        chapter: gt.topic?.chapter?.slug,
        difficulty: gt.difficulty,
        createdAt: gt.createdAt,
        source: 'generatedTest',
        topicId,
        meta: {
          topicId,
          topicName: gt.topic?.name,
          chapterId,
          chapterName: gt.topic?.chapter?.name,
          subjectId,
          subjectName,
          questionCount: gt.questions.length,
          difficulty: gt.difficulty,
        },
      });
    }

    return candidates;
  }

  // ── Scoring (Prompts 2, 5, 7) ─────────────────────────────────────────

  private scoreCandidate(candidate: CandidateContent): RecommendationItem {
    if (!this.signals) {
      return this.toRecommendationItem(candidate, 0, ['No signals available']);
    }

    let score = 0;
    const reasons: string[] = [];
    const signalsApplied: string[] = [];
    let engagementBoost = 0;
    let resumeBoost = 0;

    // 1. Profile match
    if (candidate.board === this.signals.board && candidate.grade === this.signals.grade) {
      score += SCORE_WEIGHTS.PROFILE_MATCH;
      reasons.push('Matches your board and grade');
      signalsApplied.push('profile_match');
    } else if (candidate.board === this.signals.board || candidate.grade === this.signals.grade) {
      score += SCORE_WEIGHTS.PROFILE_MATCH * 0.5;
      signalsApplied.push('profile_partial');
    }

    // 2. Subject relevance
    if (this.signals.subjects.includes(candidate.subject)) {
      score += 15;
      reasons.push(`In your ${candidate.subject} curriculum`);
      signalsApplied.push('subject_match');
    }

    // 3. Weak subject boost (topic-first, then fall back to subject string)
    const candidateTopicId = candidate.topicId || (candidate.meta?.topicId as string | undefined);
    const weakByTopic = candidateTopicId && this.signals.weakSubjectTopicIds.includes(candidateTopicId);
    const weakBySubject = this.signals.weakSubjects.includes(candidate.subject);
    if (weakByTopic || weakBySubject) {
      score += SCORE_WEIGHTS.WEAK_SUBJECT_BOOST;
      reasons.push('Helps strengthen a weak area');
      signalsApplied.push(weakByTopic ? 'weak_topic' : 'weak_subject');
    }

    // 4. Low-score boost (topic-first, then fall back to chapter string)
    const lowByTopic = candidateTopicId && this.signals.lowScoreTopicIds.includes(candidateTopicId);
    const lowByChapter = candidate.chapter && this.signals.lowScoreChapters.includes(candidate.chapter);
    if (lowByTopic || lowByChapter) {
      score += SCORE_WEIGHTS.LOW_SCORE_CHAPTER;
      reasons.push('Review recommended based on test performance');
      signalsApplied.push(lowByTopic ? 'low_score_topic' : 'low_score_chapter');
    }

    // 5. Recent topic relevance (topic-first)
    if (candidateTopicId && this.signals.recentTopicIds.includes(candidateTopicId)) {
      score += SCORE_WEIGHTS.RECENT_TOPIC_RELEVANCE;
      reasons.push('Related to your recent studies');
      signalsApplied.push('recent_topic');
    }

    // 6. Resume incomplete session — +50, highest priority (Prompt 5)
    if (candidateTopicId && this.signals.incompleteTopicIds.has(candidateTopicId)) {
      resumeBoost = SCORE_WEIGHTS.RESUME_SESSION;
      score += resumeBoost;
      reasons.push('Continue where you left off');
      signalsApplied.push('resume_session');
    }

    // 7. Difficulty match
    const candidateDifficulty = candidate.difficulty?.toUpperCase() || 'MEDIUM';
    if (candidateDifficulty === this.signals.engagementPatterns.preferredDifficulty) {
      score += SCORE_WEIGHTS.DIFFICULTY_MATCH;
      signalsApplied.push('difficulty_match');
    }

    // 8. Freshness
    const daysSinceCreation = (Date.now() - candidate.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 30) {
      score += SCORE_WEIGHTS.FRESHNESS;
      if (daysSinceCreation < 7) reasons.push('New content');
      signalsApplied.push('freshness');
    }

    // 9. Practice boost for struggling areas
    if (candidate.type === 'practice' && score > 30) {
      score += 5;
      signalsApplied.push('practice_boost');
    }

    // 10. Activity type frequency
    const typeCounts = this.signals.engagementPatterns.typeCounts;
    const activityType = candidate.type === 'test' ? 'test' : candidate.type === 'notes' ? 'notes' : candidate.type;
    if (typeCounts[activityType] && typeCounts[activityType] >= 3) {
      score += SCORE_WEIGHTS.ENGAGEMENT_HISTORY;
      reasons.push('Matches your learning preferences');
      signalsApplied.push('type_frequency');
    }

    // 11. Engagement feedback loop (Prompt 2 — mapped type)
    const mappedEngType = mapSourceToEngagementType(candidate.source);
    const engagement = this.signals.engagementByType[mappedEngType];

    if (engagement && engagement.shown > 0) {
      const clickThroughRate = engagement.clicked / engagement.shown;
      const completionRate = engagement.completed / engagement.shown;
      const ignoreRate = engagement.ignored / engagement.shown;

      if (engagement.shown >= 5 && clickThroughRate > 0.5) {
        const boost = SCORE_WEIGHTS.POSITIVE_ENGAGEMENT_BOOST;
        engagementBoost += boost;
        score += boost;
        reasons.push('You engage well with this content type');
        signalsApplied.push('engagement_positive');
      }
      if (engagement.clicked >= 3 && completionRate > 0.6) {
        const boost = Math.round(SCORE_WEIGHTS.POSITIVE_ENGAGEMENT_BOOST * 0.5);
        engagementBoost += boost;
        score += boost;
        reasons.push('High completion rate for this type');
        signalsApplied.push('engagement_completion');
      }
      if (engagement.shown >= 5 && ignoreRate > 0.3) {
        engagementBoost += SCORE_WEIGHTS.NEGATIVE_ENGAGEMENT_PENALTY;
        score += SCORE_WEIGHTS.NEGATIVE_ENGAGEMENT_PENALTY;
        signalsApplied.push('engagement_negative');
      }

      logger.debug('[ENGAGEMENT_MAPPING]', {
        candidateSource: candidate.source,
        mappedType: mappedEngType,
        engagementScore: engagementBoost,
      });
    }

    if (reasons.length === 0) {
      reasons.push('Recommended for your learning journey');
    }

    // Prompt 7 — observability
    logger.debug('[RECOMMENDATION_DECISION]', {
      studentId: this.userId,
      candidateId: candidate.contentId,
      topicId: candidateTopicId || null,
      score,
      signalsApplied,
      engagementBoost,
      resumeBoost,
    });

    return this.toRecommendationItem(candidate, score, reasons);
  }

  // ── Output Construction (Prompt 1 — normalized contentId) ──────────────

  private toRecommendationItem(
    candidate: CandidateContent,
    score: number,
    reasoning: string[],
  ): RecommendationItem {
    const nId = normalizeContentId(candidate);

    if (nId !== candidate.contentId) {
      logger.debug('[CONTENT_ID_NORMALIZED]', {
        originalId: candidate.contentId,
        normalizedId: nId,
      });
    }

    return {
      id: candidate.id,
      contentId: nId,
      type: candidate.type,
      title: candidate.title,
      subject: candidate.subject,
      chapter: candidate.chapter,
      difficulty: candidate.difficulty,
      score,
      reasoning,
      meta: {
        ...candidate.meta,
        topicId: candidate.topicId || candidate.meta?.topicId || null,
        chapterId: candidate.meta?.chapterId || null,
        subjectId: candidate.meta?.subjectId || null,
      },
    };
  }

  // ── Diversity & Deduplication (Prompt 4) ───────────────────────────────

  private diversifyAndSort(items: RecommendationItem[], limit: number): RecommendationItem[] {
    const seenIds = new Set<string>();
    const unique = items.filter(item => {
      if (seenIds.has(item.contentId)) return false;
      seenIds.add(item.contentId);
      return true;
    });

    unique.sort((a, b) => b.score - a.score);

    const result: RecommendationItem[] = [];
    const usedTopicIds = new Set<string>();
    const typeCounts: Record<string, number> = {};

    const canAdd = (item: RecommendationItem): boolean => {
      const tid = item.meta?.topicId as string | undefined;
      if (tid && usedTopicIds.has(tid)) return false;
      if ((typeCounts[item.type] || 0) >= MAX_PER_TYPE) return false;
      return true;
    };

    const addItem = (item: RecommendationItem) => {
      result.push(item);
      typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
      const tid = item.meta?.topicId as string | undefined;
      if (tid) usedTopicIds.add(tid);
    };

    // Phase 1: guarantee one slot per diversity type
    for (const slotType of DIVERSITY_SLOTS) {
      if (result.length >= limit) break;
      const pick = unique.find(item => item.type === slotType && canAdd(item) && !result.includes(item));
      if (pick) addItem(pick);
    }

    // Phase 2: fill remaining slots by score
    for (const item of unique) {
      if (result.length >= limit) break;
      if (result.includes(item)) continue;
      if (!canAdd(item)) continue;
      addItem(item);
    }

    // Re-sort final set so resume items float to the very top
    result.sort((a, b) => b.score - a.score);

    return result;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private getMostCommon<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined;
    const counts = new Map<T, number>();
    for (const item of arr) counts.set(item, (counts.get(item) || 0) + 1);
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

  private groupBy<T extends Record<string, unknown>>(arr: T[], key: string): Record<string, T[]> {
    return arr.reduce((acc, item) => {
      const k = String(item[key] || 'unknown');
      acc[k] = acc[k] || [];
      acc[k].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getRecommendationsForUser(
  userId: string,
  limit: number = 10,
): Promise<RecommendationItem[]> {
  const engine = new RecommendationEngine(userId);
  return engine.getRecommendations(limit);
}

/**
 * Update user's learning profile based on recent activity.
 * Call this after test completion or session end.
 */
export async function updateLearningProfile(userId: string): Promise<void> {
  try {
    const testResults = await prisma.testResult.findMany({
      where: { studentId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        AttemptQuestions: {
          include: {
            question: { select: { subject: true, chapter: true } },
            answer: { select: { autoScore: true } },
          },
        },
      },
    });

    const subjectScores: Record<string, { total: number; correct: number }> = {};
    for (const result of testResults) {
      for (const aq of result.AttemptQuestions) {
        const subject = aq.question?.subject || 'unknown';
        if (!subjectScores[subject]) subjectScores[subject] = { total: 0, correct: 0 };
        subjectScores[subject].total++;
        if (aq.answer?.autoScore && aq.answer.autoScore > 0) subjectScores[subject].correct++;
      }
    }

    const weakSubjects = Object.entries(subjectScores)
      .filter(([, stats]) => stats.total >= 5 && stats.correct / stats.total < 0.6)
      .map(([subject]) => subject);

    const strengths = Object.entries(subjectScores)
      .filter(([, stats]) => stats.total >= 5 && stats.correct / stats.total >= 0.8)
      .map(([subject, stats]) => ({
        subject,
        accuracy: Math.round((stats.correct / stats.total) * 100),
      }));

    await prisma.studentLearningProfile.upsert({
      where: { studentId: userId },
      update: { weakSubjects, strengths, updatedAt: new Date() },
      create: { studentId: userId, weakSubjects, strengths },
    });

    logger.info('RecommendationEngine.updateLearningProfile', {
      userId,
      weakSubjects,
      strengthCount: strengths.length,
    });
  } catch (error) {
    logger.error('RecommendationEngine.updateLearningProfile', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export default RecommendationEngine;
