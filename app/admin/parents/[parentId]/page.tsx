/**
 * FILE OBJECTIVE:
 * - Admin parent detail page at /admin/parents/[parentId].
 *   Shows parent profile, linked students with mastery, and management
 *   actions (block/unblock, delete account, remove student links).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/parents/[parentId]/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-07 | claude | created
 */
import React from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { AdminTopbar } from '../../../../components/admin/AdminTopbar'
import { ParentDetailClient, type ParentDetail } from './ParentDetailClient'

interface Props {
  params: Promise<{ parentId: string }>
}

// Local row type matching the Prisma select shape for parentStudent links.
type ParentLinkRow = {
  id: string
  student: {
    id: string
    name: string | null
    grade: string | null
    parentVerifiedAt: Date | null
  }
}

// Local row type for studentTopicProgress groupBy result.
type MasteryGroupRow = {
  studentId: string
  _avg: { mastery: number | null }
}

export default async function ParentDetailPage({ params }: Props) {
  const { parentId } = await params

  // Constrain to parent role so this page cannot manage non-parent accounts.
  const [parent, links] = await Promise.all([
    prisma.user.findUnique({
      where: { id: parentId, role: 'parent' },
      select: {
        id: true,
        name: true,
        email: true,
        accountStatus: true,
        createdAt: true,
      },
    }),
    prisma.parentStudent.findMany({
      where: { parentId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            grade: true,
            parentVerifiedAt: true,
          },
        },
      },
    }).catch(() => [] as ParentLinkRow[]),
  ])

  if (!parent) notFound()

  // Scope mastery aggregation to only the linked students -- avoids a full
  // table scan as StudentTopicProgress grows.
  const linkedStudentIds = links.map((l: ParentLinkRow) => l.student.id)
  const masteryRows: MasteryGroupRow[] = linkedStudentIds.length > 0
    ? await prisma.studentTopicProgress.groupBy({
        by: ['studentId'],
        where: { studentId: { in: linkedStudentIds } },
        _avg: { mastery: true },
      }).catch(() => [])
    : []

  const masteryMap = new Map<string, number>(
    masteryRows.map((r: MasteryGroupRow) => [
      r.studentId,
      Math.round((r._avg.mastery ?? 0) * 100),
    ])
  )

  const detail: ParentDetail = {
    id: parent.id,
    name: parent.name ?? null,
    email: parent.email ?? null,
    accountStatus: parent.accountStatus,
    createdAt: parent.createdAt.toISOString(),
    linkedStudents: links.map((l: ParentLinkRow) => ({
      linkId: l.id,
      studentId: l.student.id,
      studentName: l.student.name ?? null,
      studentGrade: l.student.grade ?? null,
      verifiedAt: l.student.parentVerifiedAt?.toISOString() ?? null,
      avgMastery: masteryMap.get(l.student.id) ?? 0,
    })),
  }

  return (
    <>
      <AdminTopbar title="Parent detail" />
      <div className="p-5 space-y-4 max-w-3xl">
        <div className="flex items-center gap-2">
          <Link
            href="/admin/parents"
            className="text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Parents
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <span className="text-[11px] text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
            {parent.name ?? parent.email ?? parentId}
          </span>
        </div>

        <ParentDetailClient parent={detail} />
      </div>
    </>
  )
}
