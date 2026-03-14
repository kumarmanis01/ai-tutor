import { prisma } from '@/lib/prisma'

export type ProfileMissingField = 'grade' | 'board' | 'subjects' | 'name' | 'age' | 'parent_email' | 'parent_phone'

export interface ProfileCompletenessResult {
  complete: boolean
  missingFields: ProfileMissingField[]
}

/**
 * Checks minimum required fields for a student (onboarding complete).
 * Base: name, grade (1–12), board, at least 1 subject, age.
 * When age is under 18: parent email is required (for parent verification step).
 * When age is under 13: parent phone is required (for OTP verification in onboarding).
 * Parent verification modal runs only after this returns complete (so we have contact info).
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
        parentEmail: true,
        parentPhone: true,
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

    // Under 18: need parent email for the "send code to parent" verification step
    if (Number.isFinite(ageNum) && ageNum >= 1 && ageNum < 18) {
      if (!user.parentEmail || String(user.parentEmail).trim() === '') {
        missingFields.push('parent_email')
      }
    }

    // Under 13: need parent phone for OTP verification (collected and set via send-otp in onboarding)
    if (Number.isFinite(ageNum) && ageNum >= 1 && ageNum < 13) {
      if (!user.parentPhone || String(user.parentPhone).trim() === '') {
        missingFields.push('parent_phone')
      }
    }

    return {
      complete: missingFields.length === 0,
      missingFields,
    }
  } catch {
    return empty
  }
}
