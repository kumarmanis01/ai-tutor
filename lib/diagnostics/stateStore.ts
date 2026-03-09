import { prisma } from '@/lib/prisma';

export type DiagnosticStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'not_applicable';

export interface SubjectDiagnosticMeta {
  status: DiagnosticStatus;
  /**
   * Optional identifier for the active diagnostic run (e.g. TestResult id).
   * Null when no run is currently associated.
   */
  runId?: string | null;
  /**
   * ISO timestamp string for when the diagnostic was last completed.
   * Null when never completed.
   */
  completedAt?: string | null;
  /**
   * Optional version marker so future changes to the diagnostic
   * structure can be handled without losing historical state.
   */
  version?: number;
}

export interface SubjectDiagnosticStatus extends SubjectDiagnosticMeta {
  subjectKey: string;
}

type DiagnosticMap = Record<string, SubjectDiagnosticMeta>;

interface RecommendationsShape {
  diagnostics?: DiagnosticMap;
  // Preserve any other recommendation fields (learningPath, etc.).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function toRecommendationsShape(value: unknown): RecommendationsShape {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as RecommendationsShape;
  }
  return {};
}

function toDiagnosticMap(value: unknown): DiagnosticMap {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as DiagnosticMap;
  }
  return {};
}

/**
 * Returns the current diagnostic status for a (student, subject) pair.
 *
 * When no explicit status exists in StudentLearningProfile.recommendations,
 * the status is derived from mastery data:
 * - If the student already has any StudentTopicMastery rows for the subject,
 *   diagnostics are treated as not_applicable (baseline already established).
 * - Otherwise, diagnostics are pending.
 */
export async function getSubjectDiagnosticStatus(
  studentId: string,
  subjectKey: string,
): Promise<SubjectDiagnosticStatus> {
  const profile = await prisma.studentLearningProfile.findUnique({
    where: { studentId },
    select: { id: true, recommendations: true },
  });

  const recommendations = toRecommendationsShape(profile?.recommendations ?? null);
  const diagnostics = toDiagnosticMap(recommendations.diagnostics);
  const existing = diagnostics[subjectKey];

  if (existing) {
    return {
      subjectKey,
      status: existing.status,
      runId: existing.runId ?? null,
      completedAt: existing.completedAt ?? null,
      version: typeof existing.version === 'number' ? existing.version : undefined,
    };
  }

  // Derive a sensible default from existing mastery data when no explicit
  // diagnostic metadata has been stored.
  const masteryCount = await prisma.studentTopicMastery.count({
    where: {
      studentId,
      subject: subjectKey,
    },
  });

  const derivedStatus: DiagnosticStatus = masteryCount > 0 ? 'not_applicable' : 'pending';

  return {
    subjectKey,
    status: derivedStatus,
    runId: null,
    completedAt: null,
  };
}

/**
 * Upsert diagnostic metadata for a given (student, subject).
 *
 * This helper is intentionally conservative:
 * - It merges with any existing entry for the subject.
 * - It preserves unrelated recommendations fields.
 * - It creates StudentLearningProfile on-demand when missing.
 */
export async function upsertSubjectDiagnosticStatus(
  studentId: string,
  subjectKey: string,
  meta: Partial<SubjectDiagnosticMeta>,
): Promise<SubjectDiagnosticStatus> {
  const profile = await prisma.studentLearningProfile.findUnique({
    where: { studentId },
    select: { id: true, recommendations: true },
  });

  const recommendations = toRecommendationsShape(profile?.recommendations ?? null);
  const diagnostics = toDiagnosticMap(recommendations.diagnostics);

  const previous = (diagnostics[subjectKey] ?? {}) as Partial<SubjectDiagnosticMeta>;

  const nextMeta: SubjectDiagnosticMeta = {
    status: meta.status ?? previous.status ?? 'pending',
    runId:
      meta.runId !== undefined
        ? meta.runId
        : Object.prototype.hasOwnProperty.call(previous, 'runId')
          ? previous.runId ?? null
          : null,
    completedAt:
      meta.completedAt !== undefined
        ? meta.completedAt
        : Object.prototype.hasOwnProperty.call(previous, 'completedAt')
          ? previous.completedAt ?? null
          : null,
    version:
      typeof meta.version === 'number'
        ? meta.version
        : typeof previous.version === 'number'
          ? previous.version
          : undefined,
  };

  const nextDiagnostics: DiagnosticMap = {
    ...diagnostics,
    [subjectKey]: nextMeta,
  };

  const nextRecommendations: RecommendationsShape = {
    ...recommendations,
    diagnostics: nextDiagnostics,
  };

  if (profile) {
    await prisma.studentLearningProfile.update({
      where: { id: profile.id },
      data: { recommendations: nextRecommendations },
    });
  } else {
    await prisma.studentLearningProfile.create({
      data: {
        studentId,
        recommendations: nextRecommendations,
      },
    });
  }

  return {
    subjectKey,
    ...nextMeta,
  };
}

