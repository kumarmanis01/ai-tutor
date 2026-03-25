/**
 * /admin/parents -- Parent management page
 *
 * Server component. Fetches active ParentStudent links, computes
 * per-student average mastery, passes to ParentsTable.
 */
import React from 'react'
import { prisma } from '@/lib/prisma'
import { AdminTopbar } from '@/components/admin/AdminTopbar'
import { ParentsTable, type ParentRowData } from './ParentsTable'

export default async function ParentsPage() {
  const [links, masteryRows, totalLinked] = await Promise.all([
    prisma.parentStudent.findMany({
      where: { status: 'active' },
      include: {
        parent: {
          select: { id: true, name: true, email: true, parentEmail: true },
        },
        student: {
          select: {
            id: true,
            name: true,
            grade: true,
            parentVerifiedAt: true,
            requiresParentVerification: true,
          },
        },
      },
    }).catch(() => []),

    prisma.studentTopicProgress.groupBy({
      by: ['studentId'],
      _avg: { mastery: true },
    }).catch(() => []),

    prisma.parentStudent.count({ where: { status: 'active' } }).catch(() => 0),
  ])

  // Build mastery map: studentId -> avgMastery 0-100
  const masteryMap = new Map<string, number>(
    masteryRows.map(r => [
      r.studentId,
      Math.round((r._avg.mastery ?? 0) * 100),
    ])
  )

  // Avg readiness across all linked students
  const avgReadiness =
    masteryRows.length > 0
      ? Math.round(
          masteryRows.reduce((acc, r) => acc + (r._avg.mastery ?? 0), 0) /
            masteryRows.length *
            100
        )
      : 0

  const rows: ParentRowData[] = links.map(l => ({
    id: l.id,
    parentId: l.parentId,
    parentName: l.parent.name ?? null,
    parentEmail: l.parent.email ?? l.parent.parentEmail ?? null,
    studentId: l.studentId,
    studentName: l.student.name ?? null,
    studentGrade: l.student.grade ?? null,
    verifiedAt: l.student.parentVerifiedAt?.toISOString() ?? null,
    requiresVerification: l.student.requiresParentVerification,
    avgMastery: masteryMap.get(l.studentId) ?? 0,
  }))

  return (
    <>
      <AdminTopbar title="Parents" />

      <div className="p-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Linked parents" value={totalLinked} />
          <StatCard label="Avg child readiness" value={`${avgReadiness}%`} variant={avgReadiness >= 70 ? 'green' : 'amber'} />
          <StatCard label="Last digest sent" value="N/A" />
        </div>

        <ParentsTable rows={rows} />
      </div>
    </>
  )
}

function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: string | number
  variant?: 'green' | 'amber' | 'default'
}) {
  const textCls = {
    green: 'text-[#27500A]',
    amber: 'text-[#633806]',
    default: 'text-gray-900 dark:text-white',
  }[variant]
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${textCls}`}>{value}</p>
    </div>
  )
}
