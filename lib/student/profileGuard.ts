import { prisma } from '@/lib/prisma'

export type ProfileMissingField = 'grade' | 'board' | 'subjects' | 'name'

export interface ProfileCompletenessResult {
  complete: boolean
  missingFields: ProfileMissingField[]
}

/**
 * Checks minimum required fields for a student to use the platform.
 * Required: name (non-empty), grade (1–12), board (non-empty), at least 1 subject.
 * Uses User model: name, grade, board, subjects.
 * Returns complete: false on any DB error — never throws.
 */
export async function checkProfileCompleteness(studentId: string): Promise<ProfileCompletenessResult> {
  const empty: ProfileCompletenessResult = { complete: false, missingFields: ['name', 'grade', 'board', 'subjects'] }
  try {
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        name: true,
        grade: true,
        board: true,
        subjects: true,
      },
    })

    if (!user) {
      return empty
    }

    const missingFields: ProfileMissingField[] = []

    if (!user.name || user.name.trim() === '') {
      missingFields.push('name')
    }

    const gradeNum = user.grade ? parseInt(user.grade, 10) : NaN
    if (!Number.isFinite(gradeNum) || gradeNum < 1 || gradeNum > 12) {
      missingFields.push('grade')
    }

    if (!user.board || String(user.board).trim() === '') {
      missingFields.push('board')
    }

    if (!Array.isArray(user.subjects) || user.subjects.length === 0) {
      missingFields.push('subjects')
    }

    return {
      complete: missingFields.length === 0,
      missingFields,
    }
  } catch {
    return empty
  }
}
