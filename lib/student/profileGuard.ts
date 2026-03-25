import { prisma } from '@/lib/prisma'
import { DPDP_MINOR_AGE } from '@/lib/constants/age'

export type ProfileMissingField = 'grade' | 'board' | 'subjects' | 'language' | 'name' | 'age' | 'parent_email' | 'parent_phone'

export interface StudentProfileData {
  board: string | null
  grade: string | null
  language: string | null
  subjects: string[]
  age: number | null
  parentEmail: string | null
}

export const EMPTY_PROFILE_DATA: StudentProfileData = {
  board: null,
  grade: null,
  language: null,
  subjects: [],
  age: null,
  parentEmail: null,
}

export interface ProfileCompletenessResult {
  complete: boolean
  missingFields: ProfileMissingField[]
  data: StudentProfileData
}

/**
 * Pure function: returns true only when all four academic profile fields are filled.
 *
 * Accepts a broad input type so it is safe to call with raw DB rows, session objects,
 * or typed StudentProfileData -- no casting required at call sites.
 *
 * subjects handling covers all Prisma return shapes:
 *   - string[]          -- normal case
 *   - null              -- pre-migration rows where column was NULL
 *   - []                -- empty array (DB column = '{}')
 *   - "{a,b,c}"         -- Postgres wire-format string (Neon serverless driver edge case)
 */
export function isProfileComplete(user: {
  board: string | null | undefined
  grade: number | string | null | undefined
  language: string | null | undefined
  subjects: unknown
}): boolean {
  if (!user) return false
  if (!user.board || String(user.board).trim() === '') return false
  if (user.grade === null || user.grade === undefined || String(user.grade).trim() === '') {
    return false
  }
  if (!user.language || String(user.language).trim() === '') return false

  // Resolve subject count from all possible Prisma return shapes
  let subjectCount = 0
  if (Array.isArray(user.subjects)) {
    subjectCount = (user.subjects as unknown[]).filter(Boolean).length
  } else if (typeof user.subjects === 'string' && user.subjects.length > 0) {
    // Postgres wire format: "{english,mathematics,science}"
    const cleaned = (user.subjects as string)
      .replace(/^\{/, '').replace(/\}$/, '').trim()
    subjectCount = cleaned.length > 0
      ? cleaned.split(',').filter((s) => s.trim().length > 0).length
      : 0
  }

  return subjectCount > 0
}

/**
 * Checks minimum required fields for a student (onboarding complete).
 * Base: name, grade (1-12), board, at least 1 subject, age.
 * When age is under 18: parent email is required (for parent verification step).
 * When age is under 13: parent phone is required (for OTP verification in onboarding).
 * Parent verification modal runs only after this returns complete (so we have contact info).
 * Returns complete: false on any DB error -- never throws.
 */
export async function checkProfileCompleteness(studentId: string): Promise<ProfileCompletenessResult> {
  const emptyData: StudentProfileData = EMPTY_PROFILE_DATA
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

    // subjects may be null for pre-migration rows, or returned as a Postgres
    // wire-format string "{a,b,c}" by the Neon serverless driver.
    // Normalise to string[] here so both the missingFields check and the
    // returned data.subjects are always consistent.
    const subjectsArr: unknown = user.subjects
    let resolvedSubjects: string[] = []
    if (Array.isArray(subjectsArr)) {
      resolvedSubjects = (subjectsArr as string[]).filter(Boolean)
    } else if (typeof subjectsArr === 'string' && subjectsArr.length > 0) {
      resolvedSubjects = subjectsArr
        .replace(/^\{/, '').replace(/\}$/, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
    if (resolvedSubjects.length === 0) {
      missingFields.push('subjects')
    }

    if (!user.language || String(user.language).trim() === '') {
      missingFields.push('language')
    }

    const ageNum = user.age != null ? Number(user.age) : NaN
    if (!Number.isFinite(ageNum) || ageNum < 1 || ageNum > 120) {
      missingFields.push('age')
    }

    // Under DPDP_MINOR_AGE (13): parent email required for legal consent (DPDP Act 2023)
    // Age 13-17: parent email is useful but not legally required -- do not block profile completion
    if (Number.isFinite(ageNum) && ageNum >= 1 && ageNum < DPDP_MINOR_AGE) {
      if (!user.parentEmail || String(user.parentEmail).trim() === '') {
        missingFields.push('parent_email')
      }
    }

    // Under DPDP_MINOR_AGE: need parent phone for OTP verification (collected and set via send-otp in onboarding)
    if (Number.isFinite(ageNum) && ageNum >= 1 && ageNum < DPDP_MINOR_AGE) {
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
        subjects: resolvedSubjects,
        age: user.age ?? null,
        parentEmail: user.parentEmail ?? null,
      },
    }
  } catch {
    return empty
  }
}
