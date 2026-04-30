/**
 * /admin/users -- Students management page
 *
 * Server component. Fetches up to 50 students, computes stats,
 * passes rows to StudentsTable for client-side filtering.
 */
import React from 'react';
import { prisma } from '@/lib/prisma';
import { StudentsTable, type StudentRowData } from './StudentsTable';

export default async function StudentsPage() {
  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [students, totalStudents, wau, paidCount, diagCount] = await Promise.all([
    prisma.user
      .findMany({
        where: { role: 'user' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          name: true,
          email: true,
          grade: true,
          board: true,
          age: true,
          isAdult: true,
          accountStatus: true,
          lastSessionDate: true,
          totalXp: true,
          level: true,
          subscriptionStatus: true,
          createdAt: true,
        },
      })
      .catch(() => []),

    prisma.user.count({ where: { role: 'user' } }).catch(() => 0),

    prisma.user
      .count({
        where: { role: 'user', lastSessionDate: { gte: since7d } },
      })
      .catch(() => 0),

    prisma.user
      .count({
        where: { role: 'user', subscriptionStatus: { not: 'free' } },
      })
      .catch(() => 0),

    prisma.diagnosticSession.count({ where: { status: 'COMPLETED' } }).catch(() => 0),
  ]);

  const diagPct = totalStudents > 0 ? Math.round((diagCount / totalStudents) * 100) : 0;

  const rows: StudentRowData[] = students.map((s) => ({
    id: s.id,
    name: s.name ?? null,
    email: s.email ?? null,
    grade: s.grade ?? null,
    board: s.board ?? null,
    age: s.age ?? null,
    isAdult: s.isAdult,
    accountStatus: s.accountStatus,
    subscriptionStatus: s.subscriptionStatus,
    totalXp: s.totalXp,
    level: s.level,
    lastSessionDate: s.lastSessionDate?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <>
      <div className="p-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total students" value={totalStudents} />
          <StatCard label="Active this week" value={wau} variant="green" />
          <StatCard label="Paid subscribers" value={paidCount} variant="blue" />
          <StatCard label="Diagnostic done" value={`${diagPct}%`} />
        </div>

        {/* Table */}
        <StudentsTable students={rows} />
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
  value: string | number;
  variant?: 'green' | 'blue' | 'default';
}) {
  const textCls = {
    green: 'text-[#27500A]',
    blue: 'text-[#0C447C]',
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
