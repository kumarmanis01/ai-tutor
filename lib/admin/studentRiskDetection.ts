/**
 * FILE OBJECTIVE:
 * - Compute per-student risk scores and categories for admin dashboards.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/admin/studentRiskDetection.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-23T06:15:00Z | copilot | fix(strict): add typed casts for Prisma groupBy/findMany results to remove implicit-any map callbacks
 */

import { prisma } from '@/lib/prisma';

export type RiskCategory = 'low' | 'medium' | 'high';

export interface StudentRiskRow {
  studentId: string;
  email: string | null;
  name: string | null;
  board: string | null;
  grade: string | null;
  riskScore: number;
  category: RiskCategory;
  lastActiveAt: Date | null;
  inactiveDays: number | null;
  weakTopicCount: number;
  completionRate: number | null;
  accRecent: number | null;
  accPrior: number | null;
  accDelta: number | null;
  dataQuality: {
    hasTrendData: boolean;
    sessionsStarted: number;
  };
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function daysBetween(now: Date, then: Date): number {
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function weightedMean(pairs: Array<{ value: number; weight: number }>): number | null {
  let wSum = 0;
  let vSum = 0;
  for (const p of pairs) {
    if (!Number.isFinite(p.value) || !Number.isFinite(p.weight) || p.weight <= 0) continue;
    wSum += p.weight;
    vSum += p.value * p.weight;
  }
  return wSum > 0 ? vSum / wSum : null;
}

function computeRiskScore(input: {
  inactiveDays: number | null;
  weakTopicCount: number;
  accDelta: number | null;
  accRecent: number | null;
  completionRate: number | null;
  sessionsStarted: number;
}): { score: number; category: RiskCategory } {
  const baseWeights = {
    inactivity: 0.35,
    weak: 0.25,
    trend: 0.25,
    completion: 0.15,
  };

  const scores: Array<{ key: keyof typeof baseWeights; w: number; s: number | null }> = [
    {
      key: 'inactivity',
      w: baseWeights.inactivity,
      s: input.inactiveDays == null ? null : clamp01((input.inactiveDays - 7) / 23),
    },
    {
      key: 'weak',
      w: baseWeights.weak,
      s: clamp01(input.weakTopicCount / 5),
    },
    {
      key: 'trend',
      w: baseWeights.trend,
      s:
        input.accDelta == null
          ? null
          : clamp01(Math.max(0, -input.accDelta) / 0.2) *
            (input.accRecent != null && input.accRecent < 0.5 ? 1.2 : 1),
    },
    {
      key: 'completion',
      w: baseWeights.completion,
      s:
        input.sessionsStarted >= 3 && input.completionRate != null
          ? clamp01((0.6 - input.completionRate) / 0.6)
          : null,
    },
  ];

  const available = scores.filter((x) => x.s != null);
  const wSum = available.reduce((s, x) => s + x.w, 0);
  const weighted = wSum > 0 ? available.reduce((s, x) => s + x.w * (x.s ?? 0), 0) / wSum : 0;
  const score = Math.round(100 * clamp01(weighted));

  const category: RiskCategory = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  return { score, category };
}

export async function getStudentRiskList(opts: {
  limit?: number;
  offset?: number;
  board?: string;
  grade?: string;
  category?: RiskCategory;
  minScore?: number;
}): Promise<{ students: StudentRiskRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const now = new Date();

  const whereUser = {
    role: 'user' as const,
    ...(opts.board ? { board: opts.board } : {}),
    ...(opts.grade ? { grade: opts.grade } : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where: whereUser }),
    prisma.user.findMany({
      where: whereUser,
      select: { id: true, email: true, name: true, board: true, grade: true },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
  ]);

  // Strongly-type the returned user rows to avoid implicit-any in callbacks
  const usersTyped = users as {
    id: string;
    email?: string | null;
    name?: string | null;
    board?: string | null;
    grade?: string | null;
  }[];
  const studentIds = usersTyped.map((u) => u.id);
  if (studentIds.length === 0) return { students: [], total };

  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentStart7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const priorStart14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [lastActive, sessionsStarted, sessionsCompleted, weakCounts, masteryRows] =
    await Promise.all([
      prisma.structuredSession.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds } },
        _max: { startedAt: true, completedAt: true },
      }),
      prisma.structuredSession.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, startedAt: { gte: since30d } },
        _count: { id: true },
      }),
      prisma.structuredSession.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, state: 'COMPLETE', completedAt: { gte: since30d } },
        _count: { id: true },
      }),
      prisma.studentTopicProgress.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, mastery: { lt: 0.4 }, practiceCount: { gt: 5 } },
        _count: { topicId: true },
      }),
      prisma.studentTopicMastery.findMany({
        where: {
          studentId: { in: studentIds },
          lastAttemptedAt: { gte: priorStart14d },
        },
        select: {
          studentId: true,
          accuracy: true,
          questionsAttempted: true,
          lastAttemptedAt: true,
        },
        take: 50_000,
      }),
    ]);

  // Cast groupBy/findMany results to local types to avoid implicit any
  const lastActiveTyped = lastActive as Array<{
    studentId: string;
    _max: { startedAt?: Date | null; completedAt?: Date | null };
  }>;
  const sessionsStartedTyped = sessionsStarted as Array<{
    studentId: string;
    _count: { id: number };
  }>;
  const sessionsCompletedTyped = sessionsCompleted as Array<{
    studentId: string;
    _count: { id: number };
  }>;
  const weakCountsTyped = weakCounts as Array<{ studentId: string; _count: { topicId: number } }>;
  const masteryRowsTyped = masteryRows as Array<{
    studentId: string;
    accuracy: number;
    questionsAttempted: number;
    lastAttemptedAt: Date;
  }>;

  const lastMap = new Map<string, Date | null>();
  for (const r of lastActiveTyped) {
    const maxStarted = r._max.startedAt ?? null;
    const maxCompleted = r._max.completedAt ?? null;
    const t = [maxStarted, maxCompleted].filter(Boolean) as Date[];
    lastMap.set(r.studentId, t.length ? new Date(Math.max(...t.map((d) => d.getTime()))) : null);
  }

  const startedMap = new Map(sessionsStartedTyped.map((r) => [r.studentId, r._count.id]));
  const completedMap = new Map(sessionsCompletedTyped.map((r) => [r.studentId, r._count.id]));
  const weakMap = new Map(weakCountsTyped.map((r) => [r.studentId, r._count.topicId]));

  // Trend: weighted accuracy in last 7d vs 8-14d
  const recentPairs = new Map<string, Array<{ value: number; weight: number }>>();
  const priorPairs = new Map<string, Array<{ value: number; weight: number }>>();
  for (const r of masteryRowsTyped) {
    const qa =
      typeof r.questionsAttempted === 'number' && Number.isFinite(r.questionsAttempted)
        ? r.questionsAttempted
        : 0;
    const w = qa > 0 ? qa : 1;
    if (r.lastAttemptedAt >= recentStart7d) {
      const arr = recentPairs.get(r.studentId) ?? [];
      arr.push({ value: r.accuracy, weight: w });
      recentPairs.set(r.studentId, arr);
    } else {
      const arr = priorPairs.get(r.studentId) ?? [];
      arr.push({ value: r.accuracy, weight: w });
      priorPairs.set(r.studentId, arr);
    }
  }

  const students: StudentRiskRow[] = usersTyped.map((u) => {
    const last = lastMap.get(u.id) ?? null;
    const inactiveDays = last ? daysBetween(now, last) : null;
    const started = Number(startedMap.get(u.id) ?? 0);
    const completed = Number(completedMap.get(u.id) ?? 0);
    const completionRate = started > 0 ? completed / started : null;
    const weakTopicCount = Number(weakMap.get(u.id) ?? 0);

    const accRecent = weightedMean(recentPairs.get(u.id) ?? []);
    const accPrior = weightedMean(priorPairs.get(u.id) ?? []);
    const hasTrendData = accRecent != null && accPrior != null;
    const accDelta = hasTrendData ? accRecent! - accPrior! : null;

    const { score, category } = computeRiskScore({
      inactiveDays,
      weakTopicCount,
      accDelta,
      accRecent,
      completionRate,
      sessionsStarted: started,
    });

    return {
      studentId: u.id,
      email: u.email ?? null,
      name: u.name ?? null,
      board: u.board ?? null,
      grade: u.grade ?? null,
      riskScore: score,
      category,
      lastActiveAt: last,
      inactiveDays,
      weakTopicCount,
      completionRate,
      accRecent,
      accPrior,
      accDelta,
      dataQuality: { hasTrendData, sessionsStarted: started },
    };
  });

  const filtered = students.filter((s) => {
    if (opts.category && s.category !== opts.category) return false;
    if (opts.minScore != null && s.riskScore < opts.minScore) return false;
    return true;
  });

  return { students: filtered, total };
}

export async function getStudentRiskSummary(opts: {
  board?: string;
  grade?: string;
}): Promise<{ low: number; medium: number; high: number }> {
  const { students } = await getStudentRiskList({
    limit: 200,
    offset: 0,
    board: opts.board,
    grade: opts.grade,
  });
  let low = 0,
    medium = 0,
    high = 0;
  for (const s of students) {
    if (s.category === 'high') high++;
    else if (s.category === 'medium') medium++;
    else low++;
  }
  return { low, medium, high };
}
