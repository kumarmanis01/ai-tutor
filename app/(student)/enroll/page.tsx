/**
 * FILE OBJECTIVE:
 * - Server component for the flat enrollment form.
 * - Requires an active session; redirects to / if unauthenticated.
 * - Pre-fetches the academic hierarchy and existing user data for the form.
 * - If enrollment already complete (profile + diagnostics done) redirect to dashboard.
 *
 * EDIT LOG:
 * - 2026-05-05 | claude | created for flat enrollment form
 */

import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SoftDeleteStatus } from '@prisma/client';
import EnrollmentForm from './EnrollmentForm';

export const dynamic = 'force-dynamic';

export default async function EnrollPage() {
  const session = await requireActiveSession();
  if (!session) redirect('/');

  const userId = (session.user as { id: string }).id;

  const [user, hierarchy] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        language: true,
        board: true,
        grade: true,
        schoolName: true,
        subjects: true,
        parentEmail: true,
        parentPhone: true,
        parentVerifiedAt: true,
        age: true,
      },
    }),
    prisma.board.findMany({
      where: { lifecycle: SoftDeleteStatus.active },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        classes: {
          where: { lifecycle: SoftDeleteStatus.active },
          orderBy: { grade: 'asc' },
          select: {
            id: true,
            grade: true,
            slug: true,
            subjects: {
              where: { lifecycle: SoftDeleteStatus.active, isAvailable: true },
              orderBy: { name: 'asc' },
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    }),
  ]);

  const initialData = {
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    dateOfBirth: user?.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : '',
    language: user?.language ?? 'en',
    board: user?.board ?? '',
    grade: user?.grade ?? '',
    schoolName: user?.schoolName ?? '',
    subjects: user?.subjects ?? [],
    parentEmail: user?.parentEmail ?? '',
    parentPhone: user?.parentPhone ?? '',
    parentVerifiedAt: user?.parentVerifiedAt ? user.parentVerifiedAt.toISOString() : null,
  };

  return (
    <EnrollmentForm
      userId={userId}
      initialData={initialData}
      hierarchy={hierarchy}
    />
  );
}
