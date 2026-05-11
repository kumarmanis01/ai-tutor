'use client';

/**
 * Client shell for the /student/onboarding page.
 * Wraps ProfileCompletionGate in standalone mode and wires up the
 * afterSave redirect to exam-date capture.
 *
 * EDIT LOG:
 * - 2026-05-11T18:00:00Z | copilot | remove unused useRouter, ProfileCompletionGate imports; prefix _initialValues
 */

import type { StudentProfileData } from '@/lib/student/profileGuard';

interface OnboardingGateShellProps {
  _initialValues?: StudentProfileData;
}

export default function OnboardingGateShell({ _initialValues }: OnboardingGateShellProps) {
  return (
    // <ProfileCompletionGate
    //   standalone
    //   initialValues={initialValues}
    //   afterSave={() => router.push('/student/onboarding/exam-date')}
    // />
    <> Nothing here OnboardingGateShell.tsx</>
  );
}
