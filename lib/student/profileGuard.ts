import { prisma } from '@/lib/prisma'

export type ProfileMissingField = 'grade' | 'board' | 'subjects' | 'name' | 'age'

export interface ProfileCompletenessResult {
  complete: boolean
  missingFields: ProfileMissingField[]
}

/**
 * Checks minimum required fields for a student (onboarding complete).
 * Required: name, grade (1–12), board, at least 1 subject, age.
 * Parent verification gates run only after this returns complete.
 * Returns complete: false on any DB error — never throws.
 */
export async function checkProfileCompleteness(studentId: string): Promise<ProfileCompletenessResult> {
  const empty: ProfileCompletenessResult = { complete: false, missingFields: ['name', 'grade', 'board', 'subjects', 'age'] }
  try {
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        name: true,
        grade: true,
        board: true,
        subjects: true,
        age: true,
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

    const ageNum = user.age != null ? Number(user.age) : NaN
    if (!Number.isFinite(ageNum) || ageNum < 1 || ageNum > 120) {
      missingFields.push('age')
    }

    return {
      complete: missingFields.length === 0,
      missingFields,
    }
  } catch {
    return empty
  }
}
