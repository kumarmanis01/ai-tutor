import { prisma } from '@/lib/prisma'

/**
 * Returns true if the student has at least one StudentConceptState record
 * for a concept belonging to the given subject, indicating the IRT diagnostic
 * bootstrap has run for that subject.
 *
 * Never throws — returns false on any DB error.
 */
export async function hasDiagnosticForSubject(
  studentId: string,
  subjectId: string,
): Promise<boolean> {
  try {
    // StudentConceptState has no direct relation to Concept, so resolve
    // the conceptIds for the subject first, then count matching states.
    const conceptIds = await prisma.concept
      .findMany({ where: { subjectId }, select: { id: true } })
      .then((cs) => cs.map((c) => c.id))

    if (conceptIds.length === 0) return false

    const count = await prisma.studentConceptState.count({
      where: { studentId, conceptId: { in: conceptIds } },
    })
    return count > 0
  } catch {
    return false
  }
}
