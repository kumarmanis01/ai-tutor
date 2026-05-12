/**
 * FILE OBJECTIVE:
 * - Provide onboarding profile completeness helpers used for form validation and parent-channel readiness checks.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/profileGuard.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | remove legacy parentPhone checks and use parent email/whatsapp channel verification fields
 */

import { prisma } from '@/lib/prisma'
import { DPDP_MINOR_AGE } from '@/lib/constants/age'

export type ProfileMissingField = 'grade' | 'board' | 'subjects' | 'language' | 'name' | 'age' | 'parent_email' | 'parent_channel'

export interface StudentProfileData {
  board: string | null
  grade: string | null
  schoolName: string | null
  language: string | null
  subjects: string[]
  age: number | null
  parentEmail: string | null
  parentWhatsappPhone: string | null
  parentChannelVerified: boolean
  // WhatsApp number for notifications. Immutable after first save.
  whatsappPhone: string | null
}

export const EMPTY_PROFILE_DATA: StudentProfileData = {
  board: null,
  grade: null,
  schoolName: null,
  language: null,
  subjects: [],
  age: null,
  parentEmail: null,
  parentWhatsappPhone: null,
  parentChannelVerified: false,
  whatsappPhone: null,
}

export interface ProfileCompletenessResult {
  complete: boolean
  missingFields: ProfileMissingField[]
  data: StudentProfileData
}

/**
 * Pure function: returns true only when all required profile fields are filled.
 *
 * Academic fields (board, grade, language, subjects) are always required.
 * Age is also required (so we can enforce DPDP/privacy policies correctly).
 * At least one parent contact channel (email OR WhatsApp) is required
 * so we can reach parents with notifications.
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
  age?: number | null | undefined
  parentEmail?: string | null | undefined
  parentWhatsappPhone?: string | null | undefined
  whatsappPhone?: string | null | undefined
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

  if (subjectCount === 0) return false

  // Age is required (DPDP compliance: we must know age to enforce parent verification)
  const age = user.age != null ? Number(user.age) : NaN
  if (!Number.isFinite(age) || age < 1 || age > 120) return false

  // At least one parent contact channel required (email OR WhatsApp)
  const hasParentEmail = !!(user.parentEmail && String(user.parentEmail).trim().includes('@'))
  const resolvedParentWhatsapp = user.parentWhatsappPhone ?? user.whatsappPhone
  const hasParentPhone = !!(resolvedParentWhatsapp && String(resolvedParentWhatsapp).replace(/\D/g, '').length >= 10)

  return hasParentEmail || hasParentPhone
}

/**
 * Checks minimum required fields for a student (onboarding complete).
 * Base: name, grade (1-12), board, at least 1 subject, age.
 * When age is under 18: parent email is required (for parent verification step).
 * When age is under 13: one verified parent channel is required for activation.
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
        schoolName: true,
        subjects: true,
        language: true,
        age: true,
        parentEmail: true,
        parentWhatsappPhone: true,
        parentEmailVerifiedAt: true,
        parentWhatsappVerifiedAt: true,
        whatsappPhone: true,
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

    // All students: at least one parent contact channel required (email OR parent WhatsApp).
    // This ensures notifications (session updates, nudges) can always reach the parent.
    const hasParentEmail = !!(user.parentEmail && String(user.parentEmail).trim().includes('@'))
    const hasParentPhone = !!(user.parentWhatsappPhone && user.parentWhatsappPhone.replace(/\D/g, '').length >= 10)
    if (!hasParentEmail && !hasParentPhone) {
      missingFields.push('parent_email')
    }

    // Under DPDP_MINOR_AGE (13): OTP confirmation via any parent channel is required.
    if (Number.isFinite(ageNum) && ageNum >= 1 && ageNum < DPDP_MINOR_AGE) {
      if (!user.parentEmailVerifiedAt && !user.parentWhatsappVerifiedAt) {
        missingFields.push('parent_channel')
      }
    }

    return {
      complete: missingFields.length === 0,
      missingFields,
      data: {
        board: user.board ?? null,
        grade: user.grade ?? null,
        schoolName: user.schoolName ?? null,
        language: user.language ? String(user.language) : null,
        subjects: resolvedSubjects,
        age: user.age ?? null,
        parentEmail: user.parentEmail ?? null,
        parentWhatsappPhone: user.parentWhatsappPhone ?? null,
        parentChannelVerified: !!(user.parentEmailVerifiedAt || user.parentWhatsappVerifiedAt),
        whatsappPhone: user.whatsappPhone ?? null,
      },
    }
  } catch {
    return empty
  }
}
