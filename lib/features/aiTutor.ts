import { prisma } from '@/lib/prisma'

export const AI_TUTOR_FLAG_KEY = 'AI_TUTOR'

function isTruthyEnv(v: string | undefined) {
  return v === '1' || v === 'true' || v === 'TRUE'
}

/** Global kill switch. If off, nobody gets AI tutor regardless of per-student flags. */
export function isAiTutorGloballyEnabled() {
  return isTruthyEnv(process.env.ENABLE_AI_TUTOR)
}

/**
 * Distress detection must remain disabled until T43 copy review sign-off.
 * Default should be false in all envs unless explicitly enabled.
 */
export function isDistressDetectionEnabled() {
  return isTruthyEnv(process.env.ENABLE_DISTRESS_DETECTION)
}

/** Staged rollout flag: allows enabling AI tutor for a cohort of students. */
export async function isAiTutorEnabledForStudent(studentId: string) {
  if (!isAiTutorGloballyEnabled()) return false

  const flag = await prisma.studentFeatureFlag.findUnique({
    where: {
      studentId_key: {
        studentId,
        key: AI_TUTOR_FLAG_KEY,
      },
    },
    select: { enabled: true },
  })

  return flag?.enabled === true
}

