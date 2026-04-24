/**
 * Admin Learning Outcome Analytics -- read-only aggregates from StudentTopicMastery and StudentTopicProgress.
 */


/**
 * FILE OBJECTIVE:
 * - Admin analytics for learning outcomes, aggregates from StudentTopicMastery and StudentTopicProgress.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/admin/learningOutcomeAnalytics.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-23T00:00:00Z | copilot | strict-mode: add local row types, annotate callbacks, file header
 */

import { prisma } from '@/lib/prisma';

export interface LearningOutcomeSummarySubject {
  subject: string;
  studentCount: number;
  topicCount: number;
  avgAccuracy: number;
  masteryDistribution: { level: string; count: number }[];
}

export interface LearningOutcomeSummary {
  totalRecords: number;
  overallAvgAccuracy: number;
  subjects: LearningOutcomeSummarySubject[];
}

export interface LearningOutcomeBySubjectRow {
  subject: string;
  studentCount: number;
  topicCount: number;
  avgAccuracy: number;
  beginnerCount: number;
  intermediateCount: number;
  advancedCount: number;
  expertCount: number;
}

export interface TopImprovingTopicRow {
  topicId: string;
  topicName: string;
  subject: string;
  chapter: string;
  avgAccuracy: number;
  studentCount: number;
  masteryLevel: string;
}

export async function getLearningOutcomeSummary(opts: {
  board?: string;
  grade?: string;
  subjectFilter?: string;
}): Promise<LearningOutcomeSummary> {
  const where: Record<string, unknown> = {};
  if (opts.board || opts.grade) {
    where.student = {};
    if (opts.board) (where.student as Record<string, unknown>).board = opts.board;
    if (opts.grade) (where.student as Record<string, unknown>).grade = opts.grade;
  }
  if (opts.subjectFilter) where.subject = opts.subjectFilter;


  // Local row type for strict mode
  type MasteryRow = { accuracy: number; subject?: string | null; masteryLevel?: string | null };
  const records = await prisma.studentTopicMastery.findMany({
    where,
    select: { accuracy: true, subject: true, masteryLevel: true },
  }) as MasteryRow[];

  const totalRecords = records.length;
  const overallAvgAccuracy =
    totalRecords > 0 ? records.reduce((s: number, r: MasteryRow) => s + r.accuracy, 0) / totalRecords : 0;

  const bySubject = new Map<
    string,
    { accSum: number; count: number; levels: Map<string, number> }
  >();
  for (const r of records as MasteryRow[]) {
    const sub = r.subject ?? 'Unknown';
    let row = bySubject.get(sub);
    if (!row) {
      row = { accSum: 0, count: 0, levels: new Map() };
      bySubject.set(sub, row);
    }
    row.accSum += r.accuracy;
    row.count++;
    const level = r.masteryLevel ?? 'beginner';
    row.levels.set(level, (row.levels.get(level) ?? 0) + 1);
  }

  const subjects: LearningOutcomeSummarySubject[] = Array.from(bySubject.entries()).map(
    ([subject, row]: [string, { accSum: number; count: number; levels: Map<string, number> }]) => ({
      subject,
      studentCount: 0, // would need distinct studentId per subject
      topicCount: row.count,
      avgAccuracy: row.count > 0 ? row.accSum / row.count : 0,
      masteryDistribution: Array.from(row.levels.entries()).map(([level, count]: [string, number]) => ({
        level,
        count,
      })),
    })
  );

  return { totalRecords, overallAvgAccuracy, subjects };
}

export async function getLearningOutcomesBySubject(opts: {
  board?: string;
  grade?: string;
  limit?: number;
}): Promise<LearningOutcomeBySubjectRow[]> {
  const where: Record<string, unknown> = {};
  if (opts.board || opts.grade) {
    where.student = {};
    if (opts.board) (where.student as Record<string, unknown>).board = opts.board;
    if (opts.grade) (where.student as Record<string, unknown>).grade = opts.grade;
  }


  // Local row type for strict mode
  type MasteryRow = { subject?: string | null; studentId: string; accuracy: number; masteryLevel?: string | null };
  const rows = await prisma.studentTopicMastery.findMany({
    where,
    select: {
      subject: true,
      studentId: true,
      accuracy: true,
      masteryLevel: true,
    },
  }) as MasteryRow[];

  const bySubject = new Map<
    string,
    {
      students: Set<string>;
      accSum: number;
      count: number;
      beginner: number;
      intermediate: number;
      advanced: number;
      expert: number;
    }
  >();

  for (const r of rows as MasteryRow[]) {
    const sub = r.subject ?? 'Unknown';
    let row = bySubject.get(sub);
    if (!row) {
      row = {
        students: new Set<string>(),
        accSum: 0,
        count: 0,
        beginner: 0,
        intermediate: 0,
        advanced: 0,
        expert: 0,
      };
      bySubject.set(sub, row);
    }
    row.students.add(r.studentId);
    row.accSum += r.accuracy;
    row.count++;
    switch (r.masteryLevel) {
      case 'beginner': row.beginner++; break;
      case 'intermediate': row.intermediate++; break;
      case 'advanced': row.advanced++; break;
      case 'expert': row.expert++; break;
      default: row.beginner++; break;
    }
  }

  const limit = Math.min(opts.limit ?? 50, 100);
  return Array.from(bySubject.entries())
    .map(([subject, data]: [string, { students: Set<string>; accSum: number; count: number; beginner: number; intermediate: number; advanced: number; expert: number }]) => ({
      subject,
      studentCount: data.students.size,
      topicCount: data.count,
      avgAccuracy: data.count > 0 ? data.accSum / data.count : 0,
      beginnerCount: data.beginner,
      intermediateCount: data.intermediate,
      advancedCount: data.advanced,
      expertCount: data.expert,
    }))
    .sort((a, b) => b.topicCount - a.topicCount)
    .slice(0, limit);
}

export async function getTopImprovingTopics(opts: {
  board?: string;
  grade?: string;
  subjectFilter?: string;
  limit?: number;
}): Promise<TopImprovingTopicRow[]> {
  const where: Record<string, unknown> = {};
  if (opts.board || opts.grade) {
    where.student = {};
    if (opts.board) (where.student as Record<string, unknown>).board = opts.board;
    if (opts.grade) (where.student as Record<string, unknown>).grade = opts.grade;
  }
  if (opts.subjectFilter) where.subject = opts.subjectFilter;


  // Local row type for strict mode
  type TopicRow = { topicId: string; subject?: string | null; chapter?: string | null; accuracy: number; masteryLevel?: string | null };
  const rows = await prisma.studentTopicMastery.findMany({
    where,
    select: {
      topicId: true,
      subject: true,
      chapter: true,
      accuracy: true,
      masteryLevel: true,
    },
    orderBy: { accuracy: 'desc' },
    take: (opts.limit ?? 50) * 2,
  }) as TopicRow[];

  const byTopic = new Map<
    string,
    { subject: string; chapter: string; accSum: number; count: number; maxLevel: string }
  >();

  for (const r of rows as TopicRow[]) {
    const key = r.topicId;
    let row = byTopic.get(key);
    if (!row) {
      row = {
        subject: r.subject ?? 'Unknown',
        chapter: r.chapter ?? '',
        accSum: 0,
        count: 0,
        maxLevel: r.masteryLevel ?? 'beginner',
      };
      byTopic.set(key, row);
    }
    row.accSum += r.accuracy;
    row.count++;
    if (["expert", "advanced", "intermediate", "beginner"].indexOf(r.masteryLevel ?? '') >
        ["expert", "advanced", "intermediate", "beginner"].indexOf(row.maxLevel)) {
      row.maxLevel = r.masteryLevel ?? 'beginner';
    }
  }


  const topicIds = Array.from(byTopic.keys());
  // Local row type for topicDef
  type TopicDefRow = { id: string; name: string };
  const topicNames = topicIds.length > 0
    ? await prisma.topicDef.findMany({
        where: { id: { in: topicIds } },
        select: { id: true, name: true },
      }).then((list: TopicDefRow[]) => new Map(list.map((t: TopicDefRow) => [t.id, t.name])))
    : new Map<string, string>();

  const limit = Math.min(opts.limit ?? 50, 100);
  return Array.from(byTopic.entries())
    .map(([topicId, data]: [string, { subject: string; chapter: string; accSum: number; count: number; maxLevel: string }]) => ({
      topicId,
      topicName: topicNames.get(topicId) ?? topicId,
      subject: data.subject,
      chapter: data.chapter,
      avgAccuracy: data.count > 0 ? data.accSum / data.count : 0,
      studentCount: data.count,
      masteryLevel: data.maxLevel,
    }))
    .sort((a, b) => b.avgAccuracy - a.avgAccuracy)
    .slice(0, limit);
}
