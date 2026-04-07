import { prisma } from '@/lib/prisma'
import { getSubjectDiagnosticStatus } from '@/lib/diagnostics/stateStore'

/**
 * Returns true if the student has completed (or skipped) the diagnostic for a
 * subject, or already has IRT bootstrap data.
 *
 * Two-phase check (either is sufficient):
 *  1. StudentLearningProfile.recommendations.diagnostics[subjectId].status
 *     is 'completed' or 'skipped' or 'not_applicable' -- set immediately on
 *     diagnostic submission so the gate unlocks before the bootstrap job runs.
 *  2. At least one StudentConceptState row exists for the subject -- indicates
 *     the bootstrap job has finished (legacy / fallback path).
 *
 * Never throws -- returns false on any DB error.
 */
export async function hasDiagnosticForSubject(
  studentId: string,
  subjectId: string,
): Promise<boolean> {
  try {
    // Fast path: check the diagnostic status flag set at submission time.
    const statusRecord = await getSubjectDiagnosticStatus(studentId, subjectId)
    if (
      statusRecord.status === 'completed' ||
      statusRecord.status === 'skipped' ||
      statusRecord.status === 'not_applicable'
    ) {
      return true
    }

    // Fallback: bootstrap job may have run even without the status flag
    // (e.g. legacy data or manual resets).
    const count = await prisma.studentConceptState.count({
      where: {
        studentId,
        concept: { subjectId },
      },
    })
    return count > 0
  } catch {
    return false
  }
}
