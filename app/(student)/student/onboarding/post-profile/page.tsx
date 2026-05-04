/**
 * Post-profile routing gate.
 *
 * Called immediately after OnboardingGateShell saves the student profile.
 * Reads grade from DB and routes:
 *   Grade 1-7 (DPDP under-13 proxy) -> /student/onboarding/consent-wait
 *   Grade 8+                         -> /diagnostic/[firstSubjectId]
 *   No grade yet                     -> back to /student/onboarding
 */

import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateAgeFromDob } from '@/lib/student/calculateAgeFromDob';

export const dynamic = 'force-dynamic';

const DPDP_MINOR_AGE = 13;
// Grade proxy fallback when no DOB is stored (grade 7 -> typically 12 years old).
const DPDP_MAX_GRADE = 7;

export default async function PostProfilePage() {
  const session = await requireActiveSession();
  if (!session) redirect('/');

  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { grade: true, subjects: true, age: true, dateOfBirth: true },
  });

  if (!user?.grade) {
    redirect('/student/onboarding');
  }

  const gradeNum = parseInt(user.grade, 10);
  if (!Number.isFinite(gradeNum)) {
    redirect('/student/onboarding');
  }

  // Determine actual age: prefer stored DOB, then stored age int, then grade proxy.
  let resolvedAge: number | null = null;
  if (user.dateOfBirth) {
    resolvedAge = calculateAgeFromDob(user.dateOfBirth.toISOString());
  } else if (user.age != null) {
    resolvedAge = user.age;
  }

  // Resolve first subject for the full diagnostic CTA
  let firstSubjectId: string | null = null;
  const rawSubjects = user.subjects;
  const subjectSlugs: string[] = Array.isArray(rawSubjects)
    ? (rawSubjects as string[]).filter(Boolean)
    : typeof rawSubjects === 'string' && rawSubjects.length > 0
      ? rawSubjects.replace(/^\{/, '').replace(/\}$/, '').split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  if (subjectSlugs.length > 0) {
    const subjectDef = await prisma.subjectDef.findFirst({
      where: {
        OR: [
          { name: { in: subjectSlugs } },
          { slug: { in: subjectSlugs } },
        ],
        lifecycle: 'active',
      },
      select: { id: true },
    });
    firstSubjectId = subjectDef?.id ?? null;
  }

  // Route to consent-wait when age < 13 (real DOB check) or grade proxy triggers.
  const needsParentConsent =
    resolvedAge !== null ? resolvedAge < DPDP_MINOR_AGE : gradeNum <= DPDP_MAX_GRADE;

  if (needsParentConsent) {
    redirect('/student/onboarding/consent-wait');
  }

  // Above DPDP threshold: go straight to full diagnostic
  if (firstSubjectId) {
    redirect(`/diagnostic/${firstSubjectId}`);
  }

  // Fallback: no subjects yet -- back to onboarding
  redirect('/student/onboarding');
}
