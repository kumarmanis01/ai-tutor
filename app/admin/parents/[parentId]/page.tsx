/**
 * /admin/parents/[parentId] -- Parent account detail page
 *
 * Shows parent info, linked students, and management actions
 * (block/unblock, delete account, remove student links).
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

export default async function ParentDetailPage({ params }: Props) {
  const { parentId } = await params

  const [parent, links, masteryRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: parentId },
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
    }).catch(() => []),
    prisma.studentTopicProgress.groupBy({
      by: ['studentId'],
      _avg: { mastery: true },
    }).catch(() => []),
  ])

  if (!parent) notFound()

  const masteryMap = new Map<string, number>(
    masteryRows.map((r: any) => [
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
    linkedStudents: links.map((l: any) => ({
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
