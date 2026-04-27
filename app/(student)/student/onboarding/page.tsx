/**
 * Student onboarding -- profile setup (Screen 3)
 *
 * Server component: reads current profile from DB.
 * If profile already complete -> redirect to exam-date (avoid re-entering data).
 * If incomplete -> renders the V2 ProfileCompletionGate in standalone (full-page) mode.
 *
 * After the gate saves, it redirects to /student/onboarding/exam-date.
 * No ProfileSetupForm -- one source of truth for the profile wizard.
 */

import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isProfileComplete } from '@/lib/student/profileGuard';
import OnboardingGateShell from '@/components/student/onboarding/OnboardingGateShell';
import type { StudentProfileData } from '@/lib/student/profileGuard';

export const dynamic = 'force-dynamic';

function parseSubjects(raw: unknown): string[] {
  if (Array.isArray(raw)) return (raw as string[]).filter(Boolean);
  if (typeof raw === 'string' && raw.length > 0) {
    return raw.replace(/^\{/, '').replace(/\}$/, '').split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export default async function StudentOnboardingPage() {
  const session = await requireActiveSession();
  if (!session) redirect('/');

  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { board: true, grade: true, language: true, subjects: true, age: true, parentEmail: true, parentPhone: true, parentPhoneVerifiedAt: true, whatsappPhone: true },
  });

  if (user && isProfileComplete(user)) {
    redirect('/student/onboarding/exam-date');
  }

  const initialValues: StudentProfileData = {
    board: user?.board ?? null,
    grade: user?.grade ?? null,
    language: user?.language ?? null,
    subjects: parseSubjects(user?.subjects),
    schoolName: user?.schoolName ?? null,
    age: user?.age ?? null,
    parentEmail: user?.parentEmail ?? null,
    parentPhone: user?.parentPhone ?? null,
    parentPhoneVerified: user?.parentPhoneVerifiedAt !== null && user?.parentPhoneVerifiedAt !== undefined,
    whatsappPhone: user?.whatsappPhone ?? null,
  };

  return <OnboardingGateShell initialValues={initialValues} />;
}
