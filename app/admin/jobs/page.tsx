/**
 * /admin/jobs -- Unified Jobs page
 *
 * Server component. Shows all HydrationJob root-level entries (hierarchyLevel=0)
 * with subject enrichment. Replaces the SWR-based content-engine/jobs page as
 * the primary jobs management UI.
 */
import React from 'react'
import { prisma } from '@/lib/prisma'
import { AdminTopbar } from '../../../components/admin/AdminTopbar'
import { JobsTable, type EnrichedJob } from './JobsTable'

export default async function JobsPage() {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [jobs, statRunning, statPending, statDone, statFailed] = await Promise.all([
    prisma.hydrationJob.findMany({
      where: { hierarchyLevel: 0 },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        jobType: true,
        subjectId: true,
        subject: true,
        grade: true,
        board: true,
        status: true,
        lastError: true,
        lockedAt: true,
        hierarchyLevel: true,
        chaptersExpected: true,
        chaptersCompleted: true,
        notesExpected: true,
        notesCompleted: true,
        questionsExpected: true,
        questionsCompleted: true,
        createdAt: true,
        updatedAt: true,
      },
    }).catch(() => []),

    prisma.hydrationJob.count({ where: { hierarchyLevel: 0, status: 'running' } }).catch(() => 0),
    prisma.hydrationJob.count({ where: { hierarchyLevel: 0, status: 'pending' } }).catch(() => 0),
    prisma.hydrationJob.count({ where: { hierarchyLevel: 0, status: 'completed', updatedAt: { gte: startOfToday } } }).catch(() => 0),
    prisma.hydrationJob.count({ where: { hierarchyLevel: 0, status: 'failed' } }).catch(() => 0),
  ])

  // Enrich with SubjectDef name/grade/board
  const subjectIds = [...new Set(jobs.map((j: any ) => j.subjectId).filter(Boolean))] as string[]
  const subjectDefs = subjectIds.length
    ? await prisma.subjectDef.findMany({
        where: { id: { in: subjectIds } },
        select: {
          id: true,
          name: true,
          class: { select: { grade: true, board: { select: { slug: true } } } },
        },
      }).catch(() => [])
    : []

  const subjectMap = new Map<string, any>(subjectDefs.map((s: any) => [s.id, s]))

  const enriched: EnrichedJob[] = jobs.map((j: any ) => {
    const sub = j.subjectId ? subjectMap.get(j.subjectId) : null
    return {
      id: j.id,
      jobType: j.jobType,
      subjectName: sub?.name ?? j.subject ?? 'Unknown',
      grade: sub?.class.grade ?? j.grade ?? 0,
      boardSlug: sub?.class.board.slug ?? j.board ?? '',
      status: j.status,
      lastError: j.lastError ?? null,
      lockedAt: j.lockedAt?.toISOString() ?? null,
      chaptersExpected: j.chaptersExpected,
      chaptersCompleted: j.chaptersCompleted,
      notesExpected: j.notesExpected,
      notesCompleted: j.notesCompleted,
      questionsExpected: j.questionsExpected,
      questionsCompleted: j.questionsCompleted,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
    }
  })

  return (
    <>
      <AdminTopbar title="Jobs" runningJobs={statRunning} />

      <div className="p-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Running" value={statRunning} variant="blue" />
          <StatCard label="Pending" value={statPending} variant="amber" />
          <StatCard label="Completed today" value={statDone} variant="green" />
          <StatCard label="Failed" value={statFailed} variant={statFailed > 0 ? 'red' : 'default'} />
        </div>

        {/* Table */}
        <JobsTable jobs={enriched} />
      </div>
    </>
  )
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant: 'blue' | 'amber' | 'green' | 'red' | 'default'
}) {
  const colors = {
    blue:    'text-[#0C447C]',
    amber:   'text-[#633806]',
    green:   'text-[#27500A]',
    red:     'text-[#791F1F]',
    default: 'text-gray-900 dark:text-white',
  }
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${colors[variant]}`}>{value}</p>
    </div>
  )
}
