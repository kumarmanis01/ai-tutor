'use client';

/**
 * Client shell for the /student/onboarding page.
 *
 * S0.1 post-auth flow: Google/magic-link users land here after auth.
 * Brand-new users (no board/grade/language yet) are shown a role selection
 * screen first -- matching the spec flow "auth -> ask role -> wizard".
 * Selecting "I'm a Parent" pushes to /parent-onboarding.
 * Selecting "I'm a Student" falls through to ProfileCompletionGate.
 *
 * After profile save -> diagnostic -> learning-map.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ProfileCompletionGate from '@/components/student/ProfileCompletionGate';
import type { StudentProfileData } from '@/lib/student/profileGuard';

interface OnboardingGateShellProps {
  initialValues: StudentProfileData;
}

export default function OnboardingGateShell({ initialValues }: OnboardingGateShellProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [roleSelected, setRoleSelected] = useState(false);

  // Brand-new Google/magic-link user: no academic profile filled in yet AND
  // user-level role (not yet promoted to parent by create-child flow).
  const hasNoProfile =
    !initialValues.board &&
    !initialValues.grade &&
    !initialValues.language &&
    initialValues.subjects.length === 0;
  const isDefaultUserRole =
    (session?.user as { role?: string } | undefined)?.role === 'user' ||
    !(session?.user as { role?: string } | undefined)?.role;

  if (hasNoProfile && isDefaultUserRole && !roleSelected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950 p-6 gap-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">
          Welcome to Spinzy
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          How will you be using Spinzy?
        </p>
        <button
          type="button"
          className="w-full max-w-xs min-h-[44px] rounded-2xl bg-[#F28C28] text-white font-bold text-lg"
          onClick={() => setRoleSelected(true)}
        >
          {"I'm a Student"}
        </button>
        <button
          type="button"
          className="w-full max-w-xs min-h-[44px] rounded-2xl border-2 border-[#F28C28] text-[#F28C28] font-semibold text-base bg-transparent"
          onClick={() => router.push('/parent-onboarding')}
        >
          {"I'm a Parent"}
        </button>
      </div>
    );
  }

  return (
    <ProfileCompletionGate
      standalone
      initialValues={initialValues}
      afterSave={() => router.push('/student/onboarding/post-profile')}
    />
  );
}
