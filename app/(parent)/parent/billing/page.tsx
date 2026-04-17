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
import { formatINR, statusLabel } from '@/lib/currency/format';
import ParentUpgradeFlow from '@/components/parent/subscription/ParentUpgradeFlow';
import RetryInstallmentButton from '@/components/parent/subscription/RetryInstallmentButton';

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

  // Load active parent subscription and installments to surface EMI schedule
  const activeSubscription = await prisma.subscription.findFirst({ where: { userId: parentId, active: true }, include: { installments: { orderBy: { number: 'asc' } } } });
  

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold mb-4">Purchase subscription</h1>

      {activeSubscription && (
        <section className="mb-6 rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold">Active subscription</h2>
          <div className="text-xs text-gray-600">Plan: {activeSubscription.plan} · {activeSubscription.billingCycle}</div>
          <div className="mt-2 text-sm">Expires: {activeSubscription.endDate?.toLocaleDateString('en-IN') ?? '--'}</div>
          {activeSubscription.installments && activeSubscription.installments.length > 0 && (
            <div className="mt-3 text-sm">
              <div className="text-xs text-gray-500">EMI schedule</div>
              <ul className="mt-2 space-y-2">
                {activeSubscription.installments.map((it) => {
                  const due = new Date(it.dueAt)
                  const now = new Date()
                  const overdue = (it.status ?? '').toString().toUpperCase() !== 'PAID' && due.getTime() < now.getTime()
                  const daysOverdue = overdue ? Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)) : 0
                  return (
                    <li key={it.id} className="flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium">Installment {it.number}</div>
                        <div className="text-xs text-gray-600">Due: {due.toLocaleDateString('en-IN')}</div>
                        {overdue && <div className="text-xs text-red-600">Overdue by {daysOverdue} day{daysOverdue === 1 ? '' : 's'}</div>}
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatINR(it.amount)}</div>
                        <div className="text-xs text-gray-500">{statusLabel(it.status)}</div>
                        {activeSubscription.graceUntil && new Date(activeSubscription.graceUntil).getTime() > Date.now() && (
                          <div className="text-xs text-gray-600">Grace until {new Date(activeSubscription.graceUntil).toLocaleDateString('en-IN')}</div>
                        )}
                        {(String(it.status).toUpperCase() !== 'PAID') && (
                          <div className="mt-2">
                            <RetryInstallmentButton installmentId={it.id} />
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      <ParentUpgradeFlow childrenList={validChildren} />
    </main>
  );
}
