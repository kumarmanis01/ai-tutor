/**
 * FILE OBJECTIVE:
 * - Admin user details server page (lands at /admin/users/[id]).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/users/StudentsTable.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-18T00:00:00Z | copilot | copied from release_20260430 and adjusted folder name to [id]
 */

import React from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { UserDetailClient } from './UserDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      grade: true,
      board: true,
      age: true,
      accountStatus: true,
      subscriptionStatus: true,
      subscriptionExpiry: true,
      role: true,
      totalXp: true,
      level: true,
      currentStreak: true,
      lastSessionDate: true,
      createdAt: true,
      schoolName: true,
      subjects: true,
    },
  })

  if (!user) notFound()

  return (
    <div className="p-5 space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/users"
          className="text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Users
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-[11px] text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
          {user.name ?? user.email ?? id}
        </span>
      </div>

      <UserDetailClient
        user={{
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? null,
          phone: user.phone ?? null,
          grade: user.grade ?? null,
          board: user.board ?? null,
          age: user.age ?? null,
          accountStatus: user.accountStatus,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionExpiry: user.subscriptionExpiry?.toISOString() ?? null,
          role: user.role,
          totalXp: user.totalXp,
          level: user.level,
          currentStreak: user.currentStreak,
          lastSessionDate: user.lastSessionDate?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
          schoolName: user.schoolName ?? null,
          subjects: user.subjects,
        }}
      />
    </div>
  )
}
