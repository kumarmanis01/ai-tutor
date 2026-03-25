/**
 * /admin/notifications -- Broadcast composer + scheduled jobs + recent sends
 *
 * Server component wrapper. Computes all audience counts server-side
 * to avoid loading states; passes to NotificationComposer client component.
 */
import React from 'react'
import { prisma } from '@/lib/prisma'
import { AdminTopbar } from '@/components/admin/AdminTopbar'
import { NotificationComposer, type AudienceCounts } from './NotificationComposer'

const SCHEDULED = [
  { label: 'Weekly digest', schedule: 'Every Sunday 18:00 IST', status: 'Active' },
  { label: 'Inactive student nudge', schedule: 'Every Monday 09:00 IST', status: 'Active' },
]

export default async function NotificationsPage() {
  const now = new Date()
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    allStudents,
    inactive7d,
    grade10,
    paidSubscribers,
    studentsWithDiag,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'user' } }).catch(() => 0),
    prisma.user.count({
      where: { role: 'user', lastSessionDate: { lt: since7d } },
    }).catch(() => 0),
    prisma.user.count({ where: { role: 'user', grade: '10' } }).catch(() => 0),
    prisma.user.count({
      where: { role: 'user', subscriptionStatus: { not: 'free' } },
    }).catch(() => 0),
    prisma.diagnosticSession.findMany({
      select: { studentId: true },
      distinct: ['studentId'],
    }).then(rows => rows.length).catch(() => 0),
  ])

  const noDiagnostic = Math.max(0, allStudents - studentsWithDiag)

  const counts: AudienceCounts = {
    all_students:    allStudents,
    inactive_7d:     inactive7d,
    grade_10:        grade10,
    no_diagnostic:   noDiagnostic,
    paid_subscribers: paidSubscribers,
  }

  return (
    <>
      <AdminTopbar title="Notifications" />

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Composer */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Broadcast message
            </h2>
            <NotificationComposer counts={counts} />
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Audience overview */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
              <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-3">
                Audience overview
              </h2>
              <div className="space-y-2">
                {(Object.entries(counts) as [string, number][]).map(([key, count]) => {
                  const labels: Record<string, string> = {
                    all_students:    'All students',
                    inactive_7d:     'Inactive 7+ days',
                    grade_10:        'Grade 10',
                    no_diagnostic:   'No diagnostic',
                    paid_subscribers: 'Paid subscribers',
                  }
                  return (
                    <div key={key} className="flex justify-between text-[11px]">
                      <span className="text-gray-600 dark:text-gray-400">{labels[key] ?? key}</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Scheduled jobs */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
              <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-3">
                Scheduled sends
              </h2>
              <div className="space-y-2">
                {SCHEDULED.map(s => (
                  <div key={s.label} className="flex items-start gap-2">
                    <span className="mt-0.5 w-2 h-2 rounded-full bg-[#1D9E75] shrink-0" />
                    <div>
                      <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{s.label}</p>
                      <p className="text-[10px] text-gray-400">{s.schedule}</p>
                    </div>
                    <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EAF3DE] text-[#27500A]">
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
