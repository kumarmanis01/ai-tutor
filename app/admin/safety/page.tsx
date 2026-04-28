/**
 * /admin/safety -- Safety & Content Flags
 *
 * Server component. Fetches unresolved SafetyEvents (distress/jailbreak/unsafe)
 * and pending QuestionFlags. Passes to SafetyAlertList for client actions.
 */
import React from 'react';
import { prisma } from '@/lib/prisma';
import { AdminTopbar } from '../../../components/admin/AdminTopbar';
import { SafetyAlertList, type SafetyAlertData } from './SafetyAlertList';

export const dynamic = 'force-dynamic';

export default async function SafetyPage() {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [safetyEvents, flaggedQuestions, resolvedThisWeek, totalFlags] = await Promise.all([
    prisma.safetyEvent
      .findMany({
        where: { resolvedAt: null },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: 30,
        select: {
          id: true,
          triggerType: true,
          severity: true,
          studentId: true,
          sessionId: true,
          inputPreview: true,
          createdAt: true,
        },
      })
      .catch(() => []),

    prisma.questionFlag
      .findMany({
        where: { status: 'pending' },
        orderBy: { flaggedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          flagType: true,
          severity: true,
          questionId: true,
          flaggedAt: true,
          reviewerNotes: true,
        },
      })
      .catch(() => []),

    prisma.safetyEvent
      .count({
        where: { resolvedAt: { gte: since7d } },
      })
      .catch(() => 0),

    prisma.questionFlag.count({ where: { status: 'pending' } }).catch(() => 0),
  ]);

  const unresolvedCount = safetyEvents.length;
  const _highSeverityCount = safetyEvents.filter(
    (e) => e.severity === 'HIGH' || e.severity === 'CRITICAL'
  ).length;

  const alerts: SafetyAlertData[] = [
    ...safetyEvents.map((e) => ({
      id: e.id,
      kind: 'distress' as const,
      triggerType: e.triggerType,
      severity: e.severity,
      studentId: e.studentId,
      sessionId: e.sessionId ?? null,
      inputPreview: e.inputPreview ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
    ...flaggedQuestions.map((q) => ({
      id: q.id,
      kind: 'flag' as const,
      triggerType: q.flagType,
      severity: q.severity.toUpperCase(),
      studentId: '',
      sessionId: null,
      inputPreview: q.reviewerNotes ?? null,
      createdAt: q.flaggedAt.toISOString(),
    })),
  ];

  return (
    <>
      <AdminTopbar title="Safety" />

      <div className="p-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Unresolved alerts"
            value={unresolvedCount}
            variant={unresolvedCount > 0 ? 'red' : 'default'}
          />
          <StatCard label="Resolved this week" value={resolvedThisWeek} variant="green" />
          <StatCard
            label="Questions flagged"
            value={totalFlags}
            variant={totalFlags > 0 ? 'amber' : 'default'}
          />
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Unresolved alerts
          </h2>
          <SafetyAlertList alerts={alerts} />
        </div>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: number;
  variant?: 'red' | 'green' | 'amber' | 'default';
}) {
  const textCls = {
    red: 'text-[#791F1F]',
    green: 'text-[#27500A]',
    amber: 'text-[#633806]',
    default: 'text-gray-900 dark:text-white',
  }[variant];
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-2xl font-semibold mt-1 ${textCls}`}>{value}</p>
    </div>
  );
}
