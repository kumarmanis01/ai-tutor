import { isInAITutorRollout } from '@/lib/features/rollout';

export const AI_TUTOR_FLAG_KEY = 'AI_TUTOR';

function isTruthyEnv(v: string | undefined) {
  return v === '1' || v === 'true' || v === 'TRUE';
}

/** Global kill switch. If off, nobody gets AI tutor regardless of per-student flags. */
export function isAiTutorGloballyEnabled() {
  return isTruthyEnv(process.env.ENABLE_AI_TUTOR);
}

/**
 * Distress detection must remain disabled until T43 copy review sign-off.
 * Default should be false in all envs unless explicitly enabled.
 */
export function isDistressDetectionEnabled() {
  return isTruthyEnv(process.env.ENABLE_DISTRESS_DETECTION);
}

/**
 * Staged rollout flag: delegates to isInAITutorRollout which applies
 * kill switch → per-user override → percentage hash in order.
 */
export async function isAiTutorEnabledForStudent(studentId: string): Promise<boolean> {
  return isInAITutorRollout(studentId);
}
