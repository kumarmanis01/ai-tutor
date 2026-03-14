import { prisma } from '@/lib/prisma'

export type ProfileMissingField = 'grade' | 'board' | 'subjects' | 'language' | 'name' | 'age' | 'parent_email' | 'parent_phone'

export interface StudentProfileData {
  board: string | null
  grade: string | null
  language: string | null
  subjects: unknown[]
}

export interface ProfileCompletenessResult {
  complete: boolean
  missingFields: ProfileMissingField[]
  data: StudentProfileData
}

/**
 * Pure function: returns true only when all four academic profile fields are filled.
 */
export function isProfileComplete(user: StudentProfileData): boolean {
  if (!user.board || String(user.board).trim() === '') return false
  if (!user.grade || String(user.grade).trim() === '') return false
  if (!user.language || String(user.language).trim() === '') return false
  if (!Array.isArray(user.subjects) || user.subjects.length === 0) return false
  return true
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
  const emptyData: StudentProfileData = { board: null, grade: null, language: null, subjects: [] }
  const empty: ProfileCompletenessResult = { complete: false, missingFields: ['name', 'grade', 'board', 'subjects', 'language', 'age'], data: emptyData }
  try {
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        name: true,
        grade: true,
        board: true,
        subjects: true,
        language: true,
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

    if (!user.language || String(user.language).trim() === '') {
      missingFields.push('language')
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
      data: {
        board: user.board ?? null,
        grade: user.grade ?? null,
        language: user.language ? String(user.language) : null,
        subjects: user.subjects,
      },
    }
  } catch {
    return empty
  }
}
