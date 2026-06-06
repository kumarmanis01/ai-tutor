/**
 * /admin/content -- Coverage & Hydrate
 *
 * Single control panel for all content operations:
 * - Coverage matrix: per-subject status, chapter/topic/question counts, actions
 * - Active pipeline: live progress for running HydrationJobs
 * - NCERT ingest run log
 *
 * Server component -- all DB reads happen here. Interactive actions are
 * handled by CoverageTable (client component) via fetch + router.refresh().
 */
import React from 'react'
import { prisma } from '@/lib/prisma'
import { AdminTopbar } from '../../../components/admin/AdminTopbar'
import {
  CoverageTable,
  PipelineSection,
  IngestRunsTable,
  type CoverageRowData,
  type ContentStatus,
  type PipelineJobData,
  type IngestRunData,
} from './CoverageTable'
import { BookPanel, type BookRowData } from './BookPanel'

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

function deriveStatus(params: {
  chapterCount: number
  questionCount: number
  ragChunks: number
  jobStatus: string | null
}): ContentStatus {
  const { chapterCount, questionCount, ragChunks, jobStatus } = params
  if (jobStatus === 'running' || jobStatus === 'pending') return 'generating'
  if (jobStatus === 'failed') return 'failed'
  if (chapterCount > 0 && questionCount > 0) return 'ready'
  if (chapterCount > 0) return 'syllabus_only'
  if (ragChunks > 0) return 'ncert_only'
  return 'not_started'
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ContentPage() {
  // ── 1. Subjects with their chapters and topic counts ────────────────────
  const subjects = await prisma.subjectDef.findMany({
    where: { lifecycle: 'active' },
    include: {
      class: { include: { board: true } },
      chapters: {
        where: { lifecycle: 'active' },
        include: { topics: { where: { lifecycle: 'active' }, select: { id: true } } },
      },
    },
    orderBy: [{ class: { grade: 'asc' } }, { name: 'asc' }],
  })

  const subjectIds = subjects.map((s: any ) => s.id)
  const allTopicIds = subjects.flatMap((s: any ) =>
    s.chapters.flatMap((ch: any ) => ch.topics.map((t: any ) => t.id)),
  )

  // ── 2. Batch lookups ────────────────────────────────────────────────────
  const [generatedTestGroups, noteGroups, ragGroups, activeJobs, pipelineJobs, recentRuns, curriculumBooks] = await Promise.all([
    // GeneratedTests per topic (any approval status, active lifecycle).
    // The QUESTIONS hydration job produces GeneratedTest rows -- not the legacy
    // Question model. Counting GeneratedTest gives an accurate "questions generated"
    // signal that matches what complete-pipeline considers done.
    allTopicIds.length
      ? prisma.generatedTest.groupBy({
          by: ['topicId'],
          where: { lifecycle: 'active', topicId: { in: allTopicIds } },
          _count: { id: true },
        })
      : Promise.resolve([]),

    // Notes per topic (ACTIVE lifecycle)
    allTopicIds.length
      ? prisma.topicNote.groupBy({
          by: ['topicId'],
          where: { lifecycle: 'active', topicId: { in: allTopicIds } },
          _count: { id: true },
        })
      : Promise.resolve([]),

    // RAG chunks grouped by subject name (best-effort, no FK to SubjectDef)
    prisma.curriculumChunk.groupBy({
      by: ['subject'],
      _count: { id: true },
    }),

    // Latest root-level HydrationJob per subject (pending/running/failed)
    subjectIds.length
      ? prisma.hydrationJob.findMany({
          where: {
            subjectId: { in: subjectIds },
            hierarchyLevel: 0,
            status: { in: ['pending', 'running', 'failed'] },
          },
          select: {
            id: true,
            subjectId: true,
            status: true,
            lastError: true,
            chaptersExpected: true,
            chaptersCompleted: true,
            topicsExpected: true,
            topicsCompleted: true,
            notesExpected: true,
            notesCompleted: true,
            questionsExpected: true,
            questionsCompleted: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),

    // Running jobs for pipeline view
    prisma.hydrationJob.findMany({
      where: { hierarchyLevel: 0, status: 'running' },
      select: {
        id: true,
        subjectId: true,
        subject: true,
        board: true,
        grade: true,
        status: true,
        chaptersExpected: true,
        chaptersCompleted: true,
        topicsExpected: true,
        topicsCompleted: true,
        notesExpected: true,
        notesCompleted: true,
        questionsExpected: true,
        questionsCompleted: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),

    // Recent ingest runs
    prisma.ingestRunLog.findMany({
      orderBy: { runAt: 'desc' },
      take: 10,
    }),

    // Curriculum books (uploaded PDFs)
    prisma.curriculumBook.findMany({
      include: {
        subject: { select: { name: true } },
        bookChapters: {
          select: {
            id: true,
            _count: { select: { bookTopics: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // ── 3. Build lookup maps ────────────────────────────────────────────────

  // Topic ID → generated test count
  const generatedTestByTopic = new Map<string, number>(
    generatedTestGroups.map((g: any ) => [g.topicId as string, g._count.id]),
  )

  // Topic ID → note count
  const noteByTopic = new Map<string, number>(
    noteGroups.map((g: any ) => [g.topicId as string, g._count.id]),
  )

  // SubjectId → generated test count (via topics)
  const generatedTestBySubject = new Map<string, number>()
  // SubjectId → note count (via topics)
  const noteBySubject = new Map<string, number>()
  for (const s of subjects) {
    let gtCount = 0
    let nCount = 0
    for (const ch of s.chapters) {
      for (const t of ch.topics) {
        gtCount += generatedTestByTopic.get(t.id) ?? 0
        nCount += noteByTopic.get(t.id) ?? 0
      }
    }
    generatedTestBySubject.set(s.id, gtCount)
    noteBySubject.set(s.id, nCount)
  }

  // Subject name (lowercase) → RAG chunk count
  const ragBySubjectName = new Map<string, number>(
    ragGroups.map((g: any ) => [(g.subject ?? '').toLowerCase(), g._count.id]),
  )

  // SubjectId → latest active job
  const jobBySubject = new Map<string, any>(activeJobs.map((j: any) => [j.subjectId ?? '', j]))

  // ── 4. Build coverage rows ───────────────────────────────────────────────
  const coverageRows: CoverageRowData[] = subjects.map((s: any ) => {
    const topicCount = s.chapters.reduce((n: any, ch: any) => n + ch.topics.length, 0)
    const chapterCount = s.chapters.length
    const questionCount = generatedTestBySubject.get(s.id) ?? 0
    const noteCount = noteBySubject.get(s.id) ?? 0
    const ragChunks = ragBySubjectName.get(s.name.toLowerCase()) ?? 0
    const job = jobBySubject.get(s.id) ?? null
    const status = deriveStatus({
      chapterCount, questionCount, ragChunks, jobStatus: job?.status ?? null,
    })

    return {
      subjectId: s.id,
      subjectName: s.name,
      subjectSlug: s.slug,
      grade: s.class.grade,
      boardName: s.class.board.name,
      boardSlug: s.class.board.slug,
      language: 'en',
      chapterCount,
      topicCount,
      questionCount,
      noteCount,
      ragChunks,
      status,
      jobId: job?.id ?? null,
      jobStatus: job?.status ?? null,
      jobError: job?.lastError ?? null,
      chaptersExpected: job?.chaptersExpected ?? 0,
      chaptersCompleted: job?.chaptersCompleted ?? 0,
      topicsExpected: job?.topicsExpected ?? 0,
      topicsCompleted: job?.topicsCompleted ?? 0,
      notesExpected: job?.notesExpected ?? 0,
      notesCompleted: job?.notesCompleted ?? 0,
      questionsExpected: job?.questionsExpected ?? 0,
      questionsCompleted: job?.questionsCompleted ?? 0,
    }
  })

  // ── 5. Build pipeline rows ───────────────────────────────────────────────
  // Resolve subjectName for pipeline jobs (may differ from SubjectDef.name)
  const pipelineSubjectIds = pipelineJobs.map((j: any ) => j.subjectId).filter(Boolean) as string[]
  const pipelineSubjectMap = new Map<string, string>(
    subjects.filter((s: any ) => pipelineSubjectIds.includes(s.id)).map((s: any ) => [s.id, s.name]),
  )

  const pipelineRows: PipelineJobData[] = pipelineJobs.map((j: any ) => ({
    id: j.id,
    subjectName: j.subjectId ? (pipelineSubjectMap.get(j.subjectId) ?? j.subject ?? 'Unknown') : (j.subject ?? 'Unknown'),
    boardSlug: j.board ?? 'cbse',
    grade: j.grade ?? 0,
    status: j.status,
    chaptersExpected: j.chaptersExpected,
    chaptersCompleted: j.chaptersCompleted,
    topicsExpected: j.topicsExpected,
    topicsCompleted: j.topicsCompleted,
    notesExpected: j.notesExpected,
    notesCompleted: j.notesCompleted,
    questionsExpected: j.questionsExpected,
    questionsCompleted: j.questionsCompleted,
    createdAt: j.createdAt.toISOString(),
  }))

  // ── 6. Build ingest run rows ─────────────────────────────────────────────
  const runSubjectIds = recentRuns.map((r: any ) => r.subjectId).filter(Boolean) as string[]
  const runSubjectMap = new Map<string, { name: string; grade: string | null }>(
    subjects.filter((s: any ) => runSubjectIds.includes(s.id)).map((s: any ) => [s.id, { name: s.name, grade: s.class.grade }]),
  )

  const ingestRows: IngestRunData[] = recentRuns.map((r: any ) => {
    const sub = r.subjectId ? runSubjectMap.get(r.subjectId) : null
    return {
      id: r.id,
      runAt: r.runAt.toISOString(),
      subjectName: sub?.name ?? r.board ?? 'Unknown',
      grade: sub?.grade ?? null,
      fileSource: r.fileSource ?? null,
      chunksCreated: r.chunksCreated,
      chunksUpdated: r.chunksUpdated,
      embeddingsGenerated: r.embeddingsGenerated,
      errors: r.errors,
      durationMs: r.durationMs ?? null,
    }
  })

  const runningCount = pipelineJobs.length

  // ── 7. Build curriculum book rows ────────────────────────────────────────
  const bookRows: BookRowData[] = curriculumBooks.map((b: any ) => ({
    id: b.id,
    board: b.board,
    grade: b.grade,
    subjectId: b.subjectId,
    subjectName: b.subject.name,
    language: b.language,
    edition: b.edition,
    originalName: b.originalName,
    fileSizeBytes: b.fileSizeBytes,
    pageCount: b.pageCount,
    parseStatus: b.parseStatus,
    parseError: b.parseError,
    parsedAt: b.parsedAt?.toISOString() ?? null,
    chapterCount: b.bookChapters.length,
    topicCount: b.bookChapters.reduce((sum: any, ch: any) => sum + ch._count.bookTopics, 0),
  }))

  // Subject options for the upload modal dropdown
  const subjectOptions = subjects.map((s: any ) => ({
    id: s.id,
    name: s.name,
    grade: s.class.grade,
    boardSlug: s.class.board.slug,
  }))

  return (
    <>
      <AdminTopbar title="Coverage & Hydrate" runningJobs={runningCount} />

      <div className="p-5 space-y-5">
        {/* Workflow banner */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#FAEEDA] border border-[#EF9F27] rounded-lg px-4 py-2.5 text-[11px] text-[#633806]">
          <span className="font-semibold">Correct workflow:</span>
          <span>Step 1 -- Upload Textbook PDF (optional but recommended)</span>
          <span className="text-[#BA7517]">&rarr;</span>
          <span>Step 2 -- Ingest NCERT RAG chunks</span>
          <span className="text-[#BA7517]">&rarr;</span>
          <span>Step 3 -- Generate All Content</span>
          <span className="text-[#BA7517]">&rarr;</span>
          <span>Step 4 -- Review &amp; approve</span>
          <span className="text-[#BA7517]">&rarr;</span>
          <span>Step 5 -- Diagnostic unlocked for students</span>
        </div>

        {/* Textbook PDFs */}
        <BookPanel books={bookRows} subjects={subjectOptions} />

        {/* Coverage matrix */}
        <div>
          <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-2">
            Coverage matrix ({coverageRows.length} subjects)
          </p>
          <CoverageTable rows={coverageRows} />
        </div>

        {/* Active pipeline */}
        {pipelineRows.length > 0 && <PipelineSection jobs={pipelineRows} />}

        {/* NCERT ingest run log */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-3">
            NCERT ingest run log
          </p>
          <IngestRunsTable runs={ingestRows} />
        </div>
      </div>
    </>
  )
}
