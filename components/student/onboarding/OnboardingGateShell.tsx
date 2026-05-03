'use client';

import { useRouter } from 'next/navigation';
import ProfileCompletionGate from '@/components/student/ProfileCompletionGate';
import type { StudentProfileData } from '@/lib/student/profileGuard';

interface OnboardingGateShellProps {
  initialValues: StudentProfileData;
}

export default function OnboardingGateShell({ initialValues }: OnboardingGateShellProps) {
  const router = useRouter();

  return (
    <ProfileCompletionGate
      standalone
      initialValues={initialValues}
      afterSave={() => router.push('/student/onboarding/post-profile')}
    />
  );
}
