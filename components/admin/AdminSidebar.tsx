/**
 * FILE OBJECTIVE:
 * - Admin sidebar navigation component showing key admin sections and badges.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/admin/AdminSidebar.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | created minimal AdminSidebar to restore import
 */

import React from 'react'
import Link from 'next/link'

export interface AdminSidebarProps {
  pendingReview: number
  runningJobs: number
  failedJobs: number
  safetyAlerts: number
}

export function AdminSidebar({ pendingReview, runningJobs, failedJobs, safetyAlerts }: AdminSidebarProps) {
  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4">
      <div className="mb-6">
        <Link href="/admin" className="text-lg font-semibold text-gray-900 dark:text-gray-100">Admin</Link>
      </div>

      <nav className="space-y-1 text-sm">
        <Link href="/admin/content" className="block px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">Content</Link>
        <Link href="/admin/moderation" className="block px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">Moderation</Link>
        <Link href="/admin/jobs" className="block px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">Jobs</Link>
        <Link href="/admin/safety" className="block px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">Safety</Link>
      </nav>

      <div className="mt-6 text-sm text-gray-600 dark:text-gray-400 space-y-1">
        <div>Pending review: <strong>{pendingReview}</strong></div>
        <div>Running jobs: <strong>{runningJobs}</strong></div>
        <div>Failed jobs: <strong>{failedJobs}</strong></div>
        <div>Safety alerts: <strong>{safetyAlerts}</strong></div>
      </div>
    </aside>
  )
}

export default AdminSidebar
