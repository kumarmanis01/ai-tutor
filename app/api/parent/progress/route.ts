export const dynamic = 'force-dynamic'

/**
 * FILE OBJECTIVE:
 * - Returns subject-level progress, weak topics (attention flags), and readiness
 *   for a specific linked student. Aggregated data only — no raw answers exposed.
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created parent progress API
 * - 2026-02-07 | copilot | added force-dynamic to prevent static render error
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import type { AppSession } from '@/lib/types/auth';

const CLASS_NAME = 'ParentProgressAPI';

interface SubjectProgress {
  subject: string;
  totalTopics: number;
  topicsCovered: number;
  coveragePercent: number;
  averageMastery: number;
  strongTopics: number;
  weakTopics: number;
  chapters: ChapterProgress[];
}

interface ChapterProgress {
  chapter: string;
  topics: TopicSummary[];
  averageMastery: number;
  topicCount: number;
}

interface TopicSummary {
  topicId: string;
  masteryLevel: string;
  accuracy: number;
  questionsAttempted: number;
}

interface AttentionItem {
  topicId: string;
  subject: string;
  chapter: string;
  masteryLevel: string;
  accuracy: number;
  reason: string;
}

interface ReadinessItem {
  subject: string;
  topicsCovered: number;
  totalTopics: number;
  coveragePercent: number;
  avgMastery: number;
  readinessScore: number;
  readinessLabel: string;
}

/**
 * GET /api/parent/progress?studentId=xxx
 * Returns subject progress, weak topics, and readiness for a linked student
 */
export async function GET(req: NextRequest) {
  const start = Date.now();
  const METHOD_NAME = 'GET';

  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studentId = req.nextUrl.searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    const parentId = session.user.id;

    // Verify parent-student link exists and is active
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });
    if (!link || link.status === 'revoked') {
      return NextResponse.json({ error: 'Student not linked' }, { status: 403 });
    }

    // Log parent access for audit
    await prisma.auditLog.create({
      data: {
        userId: parentId,
        action: 'parent_view_progress',
        details: { studentId, parentId },
      },
    }).catch((err) => logger.warn('audit log failed', { error: String(err) }));

    // Fetch all mastery data for this student
    const masteryData = await prisma.studentTopicMastery.findMany({
      where: { studentId },
      orderBy: [{ subject: 'asc' }, { chapter: 'asc' }],
    });

    // Fetch total topics per subject from the curriculum (TopicDef)
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { board: true, grade: true },
    });

    const totalTopicsBySubject: Record<string, number> = {};
    if (student?.board && student?.grade) {
      const topicDefs = await prisma.topicDef.findMany({
        where: {
          chapter: {
            subject: {
              class: {
                board: { slug: student.board },
                grade: parseInt(student.grade, 10),
              },
            },
          },
        },
        select: {
          chapter: {
            select: {
              subject: {
                select: { slug: true },
              },
            },
          },
        },
      });

      for (const td of topicDefs) {
        const subjectSlug = td.chapter.subject.slug;
        totalTopicsBySubject[subjectSlug] = (totalTopicsBySubject[subjectSlug] || 0) + 1;
      }
    }

    // Group mastery by subject -> chapter -> topics
    const subjectMap: Record<string, {
      chapters: Record<string, TopicSummary[]>;
      totalMastery: number;
      count: number;
      strong: number;
      weak: number;
    }> = {};

    const attentionItems: AttentionItem[] = [];

    for (const m of masteryData) {
      if (!subjectMap[m.subject]) {
        subjectMap[m.subject] = { chapters: {}, totalMastery: 0, count: 0, strong: 0, weak: 0 };
      }
      const subj = subjectMap[m.subject];

      if (!subj.chapters[m.chapter]) {
        subj.chapters[m.chapter] = [];
      }

      const masteryValue = masteryLevelToNumber(m.masteryLevel);
      subj.chapters[m.chapter].push({
        topicId: m.topicId,
        masteryLevel: m.masteryLevel,
        accuracy: m.accuracy,
        questionsAttempted: m.questionsAttempted,
      });

      subj.totalMastery += masteryValue;
      subj.count++;

      if (m.masteryLevel === 'advanced' || m.masteryLevel === 'expert') {
        subj.strong++;
      }
      if (m.masteryLevel === 'beginner' && m.questionsAttempted >= 3) {
        subj.weak++;
        attentionItems.push({
          topicId: m.topicId,
          subject: m.subject,
          chapter: m.chapter,
          masteryLevel: m.masteryLevel,
          accuracy: m.accuracy,
          reason: m.accuracy < 0.3 ? 'very_low_accuracy' : 'low_mastery',
        });
      } else if (m.masteryLevel === 'intermediate' && m.accuracy < 0.4 && m.questionsAttempted >= 5) {
        subj.weak++;
        attentionItems.push({
          topicId: m.topicId,
          subject: m.subject,
          chapter: m.chapter,
          masteryLevel: m.masteryLevel,
          accuracy: m.accuracy,
          reason: 'declining_accuracy',
        });
      }
    }

    // Build subject progress array
    const subjectProgress: SubjectProgress[] = Object.entries(subjectMap).map(([subject, data]) => {
      const totalTopics = totalTopicsBySubject[subject] || data.count;
      const topicsCovered = data.count;
      const coveragePercent = totalTopics > 0 ? (topicsCovered / totalTopics) * 100 : 0;
      const averageMastery = data.count > 0 ? data.totalMastery / data.count : 0;

      const chapters: ChapterProgress[] = Object.entries(data.chapters).map(([chapter, topics]) => {
        const chapterMastery = topics.reduce((sum, t) => sum + masteryLevelToNumber(t.masteryLevel as any), 0);
        return {
          chapter,
          topics,
          averageMastery: topics.length > 0 ? chapterMastery / topics.length : 0,
          topicCount: topics.length,
        };
      });

      return {
        subject,
        totalTopics,
        topicsCovered,
        coveragePercent: Math.round(coveragePercent),
        averageMastery: Math.round(averageMastery * 100) / 100,
        strongTopics: data.strong,
        weakTopics: data.weak,
        chapters,
      };
    });

    // Build readiness indicators
    const readiness: ReadinessItem[] = subjectProgress.map((sp) => {
      const coverageWeight = 0.4;
      const masteryWeight = 0.6;
      const coverageScore = sp.coveragePercent;
      const masteryScore = (sp.averageMastery / 4) * 100; // 4 = max mastery (expert)
      const readinessScore = Math.round(coverageWeight * coverageScore + masteryWeight * masteryScore);

      let readinessLabel = 'not_started';
      if (sp.topicsCovered === 0) readinessLabel = 'not_started';
      else if (readinessScore >= 75) readinessLabel = 'ready';
      else if (readinessScore >= 50) readinessLabel = 'on_track';
      else readinessLabel = 'needs_work';

      return {
        subject: sp.subject,
        topicsCovered: sp.topicsCovered,
        totalTopics: sp.totalTopics,
        coveragePercent: sp.coveragePercent,
        avgMastery: sp.averageMastery,
        readinessScore,
        readinessLabel,
      };
    });

    const response = NextResponse.json({
      studentId,
      subjectProgress,
      attentionFlags: attentionItems,
      readiness,
    });

    logger.info('Parent progress data fetched', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      parentId,
      studentId,
      subjectCount: subjectProgress.length,
      attentionCount: attentionItems.length,
    });

    logger.logAPI(req, response, { className: CLASS_NAME, methodName: METHOD_NAME }, start);
    return response;
  } catch (error) {
    logger.error('Failed to fetch parent progress', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      error,
    });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}

function masteryLevelToNumber(level: string): number {
  switch (level) {
    case 'expert': return 4;
    case 'advanced': return 3;
    case 'intermediate': return 2;
    case 'beginner': return 1;
    default: return 0;
  }
}
