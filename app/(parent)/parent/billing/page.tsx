/**
 * Parent Billing page
 *
 * Server component: loads linked children for the parent and renders the
 * client-side ParentUpgradeFlow which handles plan/child selection and payment.
 *
 * FILE OBJECTIVE:
 * - Provide a parent-facing billing page where parent can purchase plans
 *   for one or more linked children (family plan support).
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-subscription.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | copilot | created parent billing page
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { AppSession } from '@/lib/types/auth';
import { prisma } from '@/lib/prisma';
import ParentUpgradeFlow from '@/components/parent/subscription/ParentUpgradeFlow';

export const metadata: Metadata = {
  title: 'Parent Billing | Spinzy',
  description: 'Purchase subscriptions for your child(ren)',
};

export default async function ParentBillingPage() {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'parent') redirect('/dashboard');

  const parentId = session.user.id;

  const links = await prisma.parentStudent.findMany({ where: { parentId, status: 'active' }, select: { studentId: true } });

  const children = await Promise.all(
    links.map(async ({ studentId }) => {
      const student = await prisma.user.findUnique({ where: { id: studentId }, select: { id: true, name: true, grade: true, board: true } });
      if (!student) return null;
      return { studentId: student.id, name: student.name ?? 'Student', grade: student.grade ?? '', board: student.board ?? '' };
    }),
  );

  const validChildren = children.filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold mb-4">Purchase subscription</h1>
      <ParentUpgradeFlow childrenList={validChildren} />
    </main>
  );
}
