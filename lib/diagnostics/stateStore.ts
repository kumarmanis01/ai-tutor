/**
 * FILE OBJECTIVE:
 * - Read and write per-subject diagnostic status for a student, stored in
 *   StudentLearningProfile.recommendations.diagnostics (JSON map keyed by subjectId).
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | add optional subjectName param to getSubjectDiagnosticStatus so mastery fallback uses subject name (matches StudentTopicMastery.subject column)
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger'

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
  /**
   * True when the submit route detected rapid-fire gaming (>30% of answers
   * under 3 s). Stored so admins can surface flagged sessions without
   * re-scanning AnswerEvent rows.
   */
  gamingFlagged?: boolean;
}

const RETAKE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SubjectDiagnosticStatus extends SubjectDiagnosticMeta {
  subjectKey: string;
  /**
   * ISO timestamp of when the next retake becomes available.
   * Null when the diagnostic has not been completed or is already retakeable.
   * Consumers (dashboard, notification layer) can show "Retake available from X".
   */
  retakeEligibleAt: string | null;
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
 *
 * @param subjectKey  - The SubjectDef ID used as the diagnostics map key.
 * @param subjectName - Optional subject name used only for the mastery-count
 *   fallback. StudentTopicMastery.subject stores the name, not the ID, so
 *   passing the name here ensures legacy data without an explicit map entry
 *   is correctly classified as not_applicable.
 */
export async function getSubjectDiagnosticStatus(
  studentId: string,
  subjectKey: string,
  subjectName?: string,
): Promise<SubjectDiagnosticStatus> {
  let profile: any = null
  try {
    profile = await prisma.studentLearningProfile.findUnique({
      where: { studentId },
      select: { id: true, recommendations: true },
    })
  } catch (err: any) {
    try { logger.warn('getSubjectDiagnosticStatus: studentLearningProfile.findUnique failed', { error: String(err) }) } catch {}
    profile = null
  }

  const recommendations = toRecommendationsShape(profile?.recommendations ?? null);
  const diagnostics = toDiagnosticMap(recommendations.diagnostics);
  const existing = diagnostics[subjectKey];

  if (existing) {
    const completedAt = existing.completedAt ?? null;
    const eligibleMs = completedAt ? new Date(completedAt).getTime() + RETAKE_COOLDOWN_MS : null;
    const retakeEligibleAt =
      eligibleMs && Date.now() < eligibleMs ? new Date(eligibleMs).toISOString() : null;
    return {
      subjectKey,
      status: existing.status,
      runId: existing.runId ?? null,
      completedAt,
      version: typeof existing.version === 'number' ? existing.version : undefined,
      gamingFlagged: existing.gamingFlagged === true ? true : undefined,
      retakeEligibleAt,
    };
  }

  // Derive a sensible default from existing mastery data when no explicit
  // diagnostic metadata has been stored.
  let masteryCount = 0
  try {
    masteryCount = await prisma.studentTopicMastery.count({
      where: {
        studentId,
        // StudentTopicMastery.subject stores the subject name, not the ID.
        // Use subjectName when provided so the fallback correctly detects legacy mastery data.
        subject: subjectName ?? subjectKey,
      },
    })
  } catch (err: any) {
    try {
      logger.warn('getSubjectDiagnosticStatus: studentTopicMastery.count failed, defaulting to 0', { error: String(err) })
    } catch {}
    masteryCount = 0
  }

  const derivedStatus: DiagnosticStatus = masteryCount > 0 ? 'not_applicable' : 'pending'

  return {
    subjectKey,
    status: derivedStatus,
    runId: null,
    completedAt: null,
    retakeEligibleAt: null,
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
    // Once flagged, always flagged -- never clear the gaming flag once set.
    gamingFlagged: meta.gamingFlagged === true ? true : previous.gamingFlagged === true ? true : undefined,
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

  const completedAtFinal = nextMeta.completedAt ?? null;
  const eligibleMsFinal = completedAtFinal
    ? new Date(completedAtFinal).getTime() + RETAKE_COOLDOWN_MS
    : null;
  const retakeEligibleAt =
    eligibleMsFinal && Date.now() < eligibleMsFinal
      ? new Date(eligibleMsFinal).toISOString()
      : null;

  return {
    subjectKey,
    ...nextMeta,
    retakeEligibleAt,
  };
}

