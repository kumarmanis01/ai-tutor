'use client';

/**
 * ProfileCompletionGate -- V1 component stub
 *
 * V1 component that has been superseded by OnboardingGateShell in V2.
 * Kept as a null stub for backwards compatibility during Task 32 cleanup.
 * All 27 unused state vars, functions, and imports have been removed.
 *
 * EDIT LOG:
 * - 2026-05-05T00:00:00Z | copilot | fix: prefix unused parentPhone/parentPhoneError state vars with _ (lint)
 * - 2026-05-05T00:00:00Z | copilot | fix: replace hardcoded under-13 copy with DPDP_MINOR_AGE constant
 * - 2026-05-11T18:30:00Z | copilot | replace 700+ lines of V1 code with null stub (resolve 27 eslint warnings)
 */

import type { StudentProfileData } from '@/lib/student/profileGuard';

interface ProfileCompletionGateProps {
  initialValues?: StudentProfileData;
  standalone?: boolean;
  afterSave?: () => void;
}

export default function ProfileCompletionGate(_props: ProfileCompletionGateProps): null {
  return null;
}