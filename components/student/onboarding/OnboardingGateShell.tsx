'use client';

/**
 * Client shell for the /student/onboarding page.
 * Wraps ProfileCompletionGate in standalone mode and wires up the
 * afterSave redirect to exam-date capture.
 */

import { useRouter } from 'next/navigation';
import ProfileCompletionGate from '@/components/student/ProfileCompletionGate';
import type { StudentProfileData } from '@/lib/student/profileGuard';

interface OnboardingGateShellProps {
  initialValues: StudentProfileData;
}

export default function OnboardingGateShell({ initialValues }: OnboardingGateShellProps) {
  // const router = useRouter();
  return (
    // <ProfileCompletionGate
    //   standalone
    //   initialValues={initialValues}
    //   afterSave={() => router.push('/student/onboarding/exam-date')}
    // />
    <> Nothing here OnboardingGateShell.tsx</>
  );
}
