/**
 * Consent waiting page for under-DPDP students (Grade 1-7).
 *
 * Students land here after profile save while waiting for parent consent.
 * They can:
 *   - Complete a quick placement quiz
 *   - Choose their study buddy name
 * Once consent is granted (accountStatus = active), the CTA enables full diagnostic.
 */

import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ConsentWaitShell from '@/components/student/onboarding/ConsentWaitShell';

export const dynamic = 'force-dynamic';

export default async function ConsentWaitPage() {
  const session = await requireActiveSession();
  if (!session) redirect('/');

  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      grade: true,
      board: true,
      subjects: true,
      accountStatus: true,
      parentPhoneVerifiedAt: true,
    },
  });

  if (!user?.grade) {
    redirect('/student/onboarding');
  }

  const grade = parseInt(user.grade, 10) || 0;
  const board = user.board ?? '';

  const consentGranted =
    user.accountStatus === 'active' || user.parentPhoneVerifiedAt !== null;

  // Resolve first subject id for diagnostic redirect
  let firstSubjectId: string | null = null;
  const rawSubjects = user.subjects;
  const slugs: string[] = Array.isArray(rawSubjects)
    ? (rawSubjects as string[]).filter(Boolean)
    : typeof rawSubjects === 'string' && rawSubjects.length > 0
      ? rawSubjects.replace(/^\{/, '').replace(/\}$/, '').split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  if (slugs.length > 0) {
    const sub = await prisma.subjectDef.findFirst({
      where: {
        OR: [{ name: { in: slugs } }, { slug: { in: slugs } }],
        lifecycle: 'active',
      },
      select: { id: true },
    });
    firstSubjectId = sub?.id ?? null;
  }

  return (
    <ConsentWaitShell
      studentId={userId}
      grade={grade}
      board={board}
      initialConsentGranted={consentGranted}
      initialFirstSubjectId={firstSubjectId}
    />
  );
}
