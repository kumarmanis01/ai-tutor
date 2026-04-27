import { prisma } from '@/lib/prisma';

export interface RecommendationPerformanceRow {
  ruleId: string;
  decisions: number;
  attributedDecisions: number;
  attributionPct: number;
  sessionStartRate: number;
  sessionCompletionRate: number;
  avgAccuracyImprovement: number | null;
  improvementCoverage: number;
}

export interface RecommendationPerformanceSummary {
  from: Date;
  to: Date;
  rows: RecommendationPerformanceRow[];
}

type DecisionRow = {
  id: string;
  evaluatedAt: Date;
  studentId: string;
  ruleId: string;
  topicId: string | null;
  sessionId: string | null;
};

type SessionRow = {
  id: string;
  studentId: string;
  topicId: string;
  startedAt: Date;
  completedAt: Date | null;
  state: string;
  meta: unknown;
};

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function parseScoreFromMeta(meta: unknown, key: 'practiceResult' | 'testResult'): number | null {
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as Record<string, unknown>;
  const r = m[key];
  if (!r || typeof r !== 'object') return null;
  const score = (r as Record<string, unknown>).score;
  return typeof score === 'number' && Number.isFinite(score) ? score : null;
}

/**
 * Aggregated analytics for home-engine rule performance.
 *
 * Attribution rules:
 * - If decision.sessionId exists -> attribute directly.
 * - Else attribute to earliest StructuredSession with same studentId+topicId
 *   whose startedAt is within [evaluatedAt, evaluatedAt + attributionWindowMinutes].
 */
export async function getRecommendationPerformanceSummary(opts: {
  from: Date;
  to: Date;
  attributionWindowMinutes?: number;
}): Promise<RecommendationPerformanceSummary> {
  const windowMin = Math.max(5, Math.min(opts.attributionWindowMinutes ?? 30, 180));
  const from = opts.from;
  const to = opts.to;

  const decisions: DecisionRow[] = await prisma.homeRecommendationDecision.findMany({
    where: { evaluatedAt: { gte: from, lte: to } },
    select: { id: true, evaluatedAt: true, studentId: true, ruleId: true, topicId: true, sessionId: true },
    orderBy: { evaluatedAt: 'desc' },
    take: 50_000,
  });

  if (decisions.length === 0) {
    return { from, to, rows: [] };
  }

  const minEval = decisions.reduce((min, d) => (d.evaluatedAt < min ? d.evaluatedAt : min), decisions[0].evaluatedAt);
  const maxEval = decisions.reduce((max, d) => (d.evaluatedAt > max ? d.evaluatedAt : max), decisions[0].evaluatedAt);
  const sessionStartMin = new Date(minEval.getTime());
  const sessionStartMax = new Date(maxEval.getTime() + windowMin * 60 * 1000);

  // Candidate sessions within the possible attribution window range.
  const sessions: SessionRow[] = await prisma.structuredSession.findMany({
    where: {
      startedAt: { gte: sessionStartMin, lte: sessionStartMax },
    },
    select: { id: true, studentId: true, topicId: true, startedAt: true, completedAt: true, state: true, meta: true },
    orderBy: { startedAt: 'asc' },
    take: 200_000,
  });

  const sessionsByStudentTopic = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const key = `${s.studentId}:${s.topicId}`;
    const list = sessionsByStudentTopic.get(key);
    if (list) list.push(s);
    else sessionsByStudentTopic.set(key, [s]);
  }

  // Direct sessionId lookup for resume_session decisions.
  const sessionById = new Map<string, SessionRow>();
  for (const s of sessions) sessionById.set(s.id, s);

  const byRule = new Map<
    string,
    {
      decisions: number;
      attributed: number;
      started: number;
      completed: number;
      improvementSum: number;
      improvementCount: number;
    }
  >();

  for (const d of decisions) {
    const rule = d.ruleId || 'unknown';
    let agg = byRule.get(rule);
    if (!agg) {
      agg = { decisions: 0, attributed: 0, started: 0, completed: 0, improvementSum: 0, improvementCount: 0 };
      byRule.set(rule, agg);
    }
    agg.decisions++;

    let attributedSession: SessionRow | undefined;
    if (d.sessionId) {
      attributedSession = sessionById.get(d.sessionId) ?? undefined;
    } else if (d.topicId) {
      const key = `${d.studentId}:${d.topicId}`;
      const candidates = sessionsByStudentTopic.get(key) ?? [];
      const maxStart = d.evaluatedAt.getTime() + windowMin * 60 * 1000;
      // candidates are sorted by startedAt asc globally; lists preserve insertion order from sessions (asc)
      for (const s of candidates) {
        const t = s.startedAt.getTime();
        if (t < d.evaluatedAt.getTime()) continue;
        if (t > maxStart) break;
        attributedSession = s;
        break;
      }
    }

    if (!attributedSession) continue;
    agg.attributed++;

    agg.started++;
    if (attributedSession.state === 'COMPLETE' && attributedSession.completedAt) {
      agg.completed++;
    }

    const practice = parseScoreFromMeta(attributedSession.meta, 'practiceResult');
    const test = parseScoreFromMeta(attributedSession.meta, 'testResult');
    if (practice != null && test != null) {
      agg.improvementSum += test - practice;
      agg.improvementCount++;
    }
  }

  const rows: RecommendationPerformanceRow[] = Array.from(byRule.entries())
    .map(([ruleId, a]) => {
      const attributionPct = a.decisions > 0 ? a.attributed / a.decisions : 0;
      const sessionStartRate = a.decisions > 0 ? a.started / a.decisions : 0;
      const sessionCompletionRate = a.started > 0 ? a.completed / a.started : 0;
      const improvementCoverage = a.started > 0 ? a.improvementCount / a.started : 0;
      const avgAccuracyImprovement = a.improvementCount > 0 ? a.improvementSum / a.improvementCount : null;
      return {
        ruleId,
        decisions: a.decisions,
        attributedDecisions: a.attributed,
        attributionPct: clamp01(attributionPct),
        sessionStartRate: clamp01(sessionStartRate),
        sessionCompletionRate: clamp01(sessionCompletionRate),
        avgAccuracyImprovement,
        improvementCoverage: clamp01(improvementCoverage),
      };
    })
    .sort((x, y) => y.decisions - x.decisions);

  return { from, to, rows };
}

