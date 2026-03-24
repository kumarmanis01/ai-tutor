import { prisma } from '@/lib/prisma'

/**
 * Returns true if the student has at least one StudentConceptState record
 * for a concept belonging to the given subject, indicating the IRT diagnostic
 * bootstrap has run for that subject.
 *
 * Never throws -- returns false on any DB error.
 */
export async function hasDiagnosticForSubject(
  studentId: string,
  subjectId: string,
): Promise<boolean> {
  try {
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
