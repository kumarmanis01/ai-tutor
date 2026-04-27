/**
 * /admin/content-approval -- Content Review
 *
 * Server component. Fetches all draft content (chapters, topics, notes, tests)
 * and passes to ContentReviewTable for interactive approve/reject.
 */
import React from 'react'
import { prisma } from '@/lib/prisma'
import { AdminTopbar } from '../../../components/admin/AdminTopbar'
import { ContentReviewTable, type ReviewItemData } from './ContentReviewTable'

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

async function fetchDraftChapters() {
  return prisma.chapterDef.findMany({
    where: { status: 'draft', lifecycle: 'active' },
    include: {
      subject: { include: { class: { include: { board: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

async function fetchDraftTopics() {
  return prisma.topicDef.findMany({
    where: { status: 'draft', lifecycle: 'active' },
    include: {
      chapter: {
        include: { subject: { include: { class: { include: { board: true } } } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

async function fetchDraftNotes() {
  return prisma.topicNote.findMany({
    where: { status: 'draft', lifecycle: 'active' },
    select: {
      id: true,
      title: true,
      language: true,
      createdAt: true,
      topic: {
        select: {
          name: true,
          chapter: {
            select: {
              name: true,
              subject: { select: { name: true, class: { select: { grade: true, board: { select: { name: true } } } } } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

async function fetchDraftTests() {
  return prisma.generatedTest.findMany({
    where: { status: 'draft', lifecycle: 'active' },
    select: {
      id: true,
      title: true,
      difficulty: true,
      language: true,
      createdAt: true,
      topic: {
        select: {
          name: true,
          chapter: {
            select: {
              name: true,
              subject: { select: { name: true, class: { select: { grade: true, board: { select: { name: true } } } } } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ContentApprovalPage() {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [chapters, topics, notes, tests, approvedToday, qualityFlags] = await Promise.all([
    fetchDraftChapters().catch(() => []),
    fetchDraftTopics().catch(() => []),
    fetchDraftNotes().catch(() => []),
    fetchDraftTests().catch(() => []),
    prisma.topicNote.count({ where: { status: 'approved', createdAt: { gte: startOfToday } } }).catch(() => 0),
    prisma.aITutorTurnLog.count({ where: { qualityFlag: { not: null }, createdAt: { gte: since7d } } }).catch(() => 0),
  ])

  // Normalise into ReviewItemData[]
  const items: ReviewItemData[] = [
    ...chapters.map(c => ({
      id: c.id,
      type: 'chapter' as const,
      subjectName: c.subject.name,
      boardName: c.subject.class.board.name,
      grade: c.subject.class.grade,
      chapterName: c.name,
      topicName: null,
      preview: c.name.substring(0, 80),
      language: null,
      difficulty: null,
      createdAt: c.createdAt.toISOString(),
    })),
    ...topics.map(t => ({
      id: t.id,
      type: 'topic' as const,
      subjectName: t.chapter.subject.name,
      boardName: t.chapter.subject.class.board.name,
      grade: t.chapter.subject.class.grade,
      chapterName: t.chapter.name,
      topicName: t.name,
      preview: t.name.substring(0, 80),
      language: null,
      difficulty: null,
      createdAt: t.createdAt.toISOString(),
    })),
    ...notes.map(n => ({
      id: n.id,
      type: 'note' as const,
      subjectName: n.topic.chapter.subject.name,
      boardName: n.topic.chapter.subject.class.board.name,
      grade: n.topic.chapter.subject.class.grade,
      chapterName: n.topic.chapter.name,
      topicName: n.topic.name,
      preview: n.title.substring(0, 80),
      language: n.language,
      difficulty: null,
      createdAt: n.createdAt.toISOString(),
    })),
    ...tests.map(t => ({
      id: t.id,
      type: 'test' as const,
      subjectName: t.topic.chapter.subject.name,
      boardName: t.topic.chapter.subject.class.board.name,
      grade: t.topic.chapter.subject.class.grade,
      chapterName: t.topic.chapter.name,
      topicName: t.topic.name,
      preview: `${t.title} (${t.difficulty})`.substring(0, 80),
      language: t.language,
      difficulty: t.difficulty,
      createdAt: t.createdAt.toISOString(),
    })),
  ]

  // Sort all by createdAt desc
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const totalPending = items.length

  return (
    <>
      <AdminTopbar title="Content Review" />

      <div className="p-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Pending review" value={totalPending} />
          <StatCard label="Approved today" value={approvedToday} />
          <StatCard label="Quality flags (7d)" value={qualityFlags} warn={qualityFlags > 0} />
        </div>

        {/* Breakdown */}
        <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
          {[
            { label: 'Chapters', count: chapters.length },
            { label: 'Topics', count: topics.length },
            { label: 'Notes', count: notes.length },
            { label: 'Tests', count: tests.length },
          ].map(({ label, count }) => (
            <span key={label} className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
              {count} {label}
            </span>
          ))}
        </div>

        {/* Review table */}
        <ContentReviewTable items={items} />
      </div>
    </>
  )
}

function StatCard({
  label,
  value,
  warn,
}: {
  label: string
  value: number
  warn?: boolean
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${warn ? 'text-[#BA7517]' : 'text-gray-900 dark:text-white'}`}>
        {value}
      </p>
    </div>
  )
}
