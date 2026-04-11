/**
 * FILE OBJECTIVE:
 * - Weekly aggregation job that computes WeeklyStudentSummary for all students
 *   who have at least one parent linked.
 * - Also refreshes SubjectProgressSummary, AttentionFlag, and ReadinessStatus.
 * - Runs via scheduler every Sunday at 4 AM UTC.
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created weekly parent summary aggregation job
 * - 2026-04-09 | copilot | respect excludeFromParentReport when selecting linked students
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Aggregate weekly summary for all linked students
 */
export async function aggregateWeeklySummaries(): Promise<number> {
  const config = await prisma.adminConfig.findUnique({
    where: { key: 'parent_reports_paused' },
  });
  if (config?.value === '1' || config?.value === 'true') {
    logger.info('weeklyParentSummary: parent reports paused via AdminConfig, skipping');
    return 0;
  }

  // Find all parent links for active students (we'll filter paused links client-side)
  const rawLinks = await prisma.parentStudent.findMany({
    where: { status: 'active', excludeFromParentReport: false },
    select: { studentId: true, isPaused: true, pausedUntil: true },
  });

  // Include studentId if at least one non-paused link exists
  const studentIdSet = new Set<string>()
  for (const l of rawLinks) {
    const paused = (l as any).isPaused && (l as any).pausedUntil && new Date((l as any).pausedUntil) > new Date()
    if (!paused) studentIdSet.add(l.studentId)
  }
  const studentIds = Array.from(studentIdSet)
  if (!studentIds.length) {
    logger.info('weeklyParentSummary: no linked students, skipping');
    return 0;
  }

  // Calculate week boundaries (Monday 00:00 UTC to Sunday 23:59 UTC)
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sunday
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 7);

  // Batch-fetch all students' week data in 3 queries instead of 3N
  const [allSessions, allTestResults, allMasteryData] = await Promise.all([
    prisma.learningSession.findMany({
      where: { studentId: { in: studentIds }, startedAt: { gte: monday, lt: sunday } },
      select: { studentId: true, duration: true, activityType: true },
    }),
    prisma.testResult.findMany({
      where: { studentId: { in: studentIds }, createdAt: { gte: monday, lt: sunday } },
      select: { studentId: true, score: true },
    }),
    prisma.studentTopicMastery.findMany({
      where: { studentId: { in: studentIds }, lastAttemptedAt: { gte: monday, lt: sunday } },
      select: { studentId: true, subject: true },
    }),
  ]);

  // Group by studentId for O(1) lookup inside the loop
  const sessionsByStudent = new Map<string, { duration: number | null; activityType: string }[]>();
  for (const s of allSessions) {
    const arr = sessionsByStudent.get(s.studentId) ?? [];
    arr.push({ duration: s.duration, activityType: s.activityType });
    sessionsByStudent.set(s.studentId, arr);
  }

  const testsByStudent = new Map<string, { score: number | null }[]>();
  for (const t of allTestResults) {
    const arr = testsByStudent.get(t.studentId) ?? [];
    arr.push({ score: t.score });
    testsByStudent.set(t.studentId, arr);
  }

  const masteryByStudent = new Map<string, { subject: string }[]>();
  for (const m of allMasteryData) {
    const arr = masteryByStudent.get(m.studentId) ?? [];
    arr.push({ subject: m.subject });
    masteryByStudent.set(m.studentId, arr);
  }

  let count = 0;

  for (const studentId of studentIds) {
    try {
      await aggregateForStudent(
        studentId,
        monday,
        sessionsByStudent.get(studentId) ?? [],
        testsByStudent.get(studentId) ?? [],
        masteryByStudent.get(studentId) ?? [],
      );
      count++;
    } catch (err) {
      logger.error('weeklyParentSummary: student aggregation failed', {
        studentId,
        error: String(err),
      });
    }
  }

  logger.info('weeklyParentSummary: completed', { studentsProcessed: count });
  return count;
}

async function aggregateForStudent(
  studentId: string,
  weekStart: Date,
  sessions: { duration: number | null; activityType: string }[],
  testResults: { score: number | null }[],
  masteryData: { subject: string }[],
) {
  // Data is pre-fetched by the caller -- no per-student reads needed here

  const subjectsActive = [...new Set(masteryData.map((m) => m.subject))];
  const topicsCovered = masteryData.length;
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const avgScore = testResults.length > 0
    ? testResults.reduce((sum, t) => sum + (t.score || 0), 0) / testResults.length
    : 0;

  // Upsert weekly summary
  await prisma.weeklyStudentSummary.upsert({
    where: { studentId_weekStart: { studentId, weekStart } },
    update: {
      topicsCovered,
      testsTaken: testResults.length,
      averageScore: Math.round(avgScore * 100) / 100,
      totalMinutes,
      sessionsCount: sessions.length,
      subjectsActive,
    },
    create: {
      studentId,
      weekStart,
      topicsCovered,
      testsTaken: testResults.length,
      averageScore: Math.round(avgScore * 100) / 100,
      totalMinutes,
      sessionsCount: sessions.length,
      subjectsActive,
    },
  });

  // Refresh subject progress summaries
  await refreshSubjectProgress(studentId);

  // Refresh attention flags
  await refreshAttentionFlags(studentId);

  // Refresh readiness status
  await refreshReadinessStatus(studentId);
}

async function refreshSubjectProgress(studentId: string) {
  const mastery = await prisma.studentTopicMastery.findMany({
    where: { studentId },
  });

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { board: true, grade: true },
  });

  // Group by subject
  const groups: Record<string, {
    totalMastery: number;
    count: number;
    strong: number;
    weak: number;
    board: string;
  }> = {};

  for (const m of mastery) {
    if (!groups[m.subject]) {
      groups[m.subject] = { totalMastery: 0, count: 0, strong: 0, weak: 0, board: student?.board || '' };
    }
    const g = groups[m.subject];
    g.count++;
    g.totalMastery += masteryToNum(m.masteryLevel);
    if (m.masteryLevel === 'advanced' || m.masteryLevel === 'expert') g.strong++;
    if (m.masteryLevel === 'beginner' && m.questionsAttempted >= 3) g.weak++;
  }

  // Get total topics per subject from curriculum
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
          select: { subject: { select: { slug: true } } },
        },
      },
    });
    for (const td of topicDefs) {
      const slug = td.chapter.subject.slug;
      totalTopicsBySubject[slug] = (totalTopicsBySubject[slug] || 0) + 1;
    }
  }

  for (const [subject, data] of Object.entries(groups)) {
    const totalTopics = totalTopicsBySubject[subject] || data.count;
    await prisma.subjectProgressSummary.upsert({
      where: { studentId_subject: { studentId, subject } },
      update: {
        board: data.board,
        totalTopics,
        topicsCovered: data.count,
        averageMastery: data.count > 0 ? data.totalMastery / data.count : 0,
        strongTopics: data.strong,
        weakTopics: data.weak,
      },
      create: {
        studentId,
        subject,
        board: data.board,
        totalTopics,
        topicsCovered: data.count,
        averageMastery: data.count > 0 ? data.totalMastery / data.count : 0,
        strongTopics: data.strong,
        weakTopics: data.weak,
      },
    });
  }
}

async function refreshAttentionFlags(studentId: string) {
  const mastery = await prisma.studentTopicMastery.findMany({
    where: { studentId },
  });

  // Clear old resolved flags
  await prisma.attentionFlag.updateMany({
    where: { studentId, resolved: false },
    data: { resolved: true },
  });

  for (const m of mastery) {
    let reason: string | null = null;

    if (m.masteryLevel === 'beginner' && m.questionsAttempted >= 3) {
      reason = m.accuracy < 0.3 ? 'very_low_accuracy' : 'low_mastery';
    } else if (m.masteryLevel === 'intermediate' && m.accuracy < 0.4 && m.questionsAttempted >= 5) {
      reason = 'declining_accuracy';
    }

    if (reason) {
      await prisma.attentionFlag.upsert({
        where: { studentId_topicId: { studentId, topicId: m.topicId } },
        update: {
          masteryLevel: m.masteryLevel,
          accuracy: m.accuracy,
          reason,
          resolved: false,
        },
        create: {
          studentId,
          topicId: m.topicId,
          subject: m.subject,
          chapter: m.chapter,
          masteryLevel: m.masteryLevel,
          accuracy: m.accuracy,
          reason,
        },
      });
    }
  }
}

async function refreshReadinessStatus(studentId: string) {
  const summaries = await prisma.subjectProgressSummary.findMany({
    where: { studentId },
  });

  for (const sp of summaries) {
    const coveragePercent = sp.totalTopics > 0 ? (sp.topicsCovered / sp.totalTopics) * 100 : 0;
    const masteryScore = (sp.averageMastery / 4) * 100;
    const readinessScore = Math.round(0.4 * coveragePercent + 0.6 * masteryScore);

    let readinessLabel = 'not_started';
    if (sp.topicsCovered === 0) readinessLabel = 'not_started';
    else if (readinessScore >= 75) readinessLabel = 'ready';
    else if (readinessScore >= 50) readinessLabel = 'on_track';
    else readinessLabel = 'needs_work';

    await prisma.readinessStatus.upsert({
      where: { studentId_subject: { studentId, subject: sp.subject } },
      update: {
        board: sp.board,
        topicsCovered: sp.topicsCovered,
        totalTopics: sp.totalTopics,
        coveragePercent: Math.round(coveragePercent),
        avgMastery: sp.averageMastery,
        readinessScore,
        readinessLabel,
      },
      create: {
        studentId,
        subject: sp.subject,
        board: sp.board,
        topicsCovered: sp.topicsCovered,
        totalTopics: sp.totalTopics,
        coveragePercent: Math.round(coveragePercent),
        avgMastery: sp.averageMastery,
        readinessScore,
        readinessLabel,
      },
    });
  }
}

function masteryToNum(level: string): number {
  switch (level) {
    case 'expert': return 4;
    case 'advanced': return 3;
    case 'intermediate': return 2;
    case 'beginner': return 1;
    default: return 0;
  }
}
