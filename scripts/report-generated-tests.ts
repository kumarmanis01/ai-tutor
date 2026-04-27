/**
 * FILE OBJECTIVE:
 * - Small investigative script to report GeneratedTest / GeneratedQuestion
 *   coverage across subjects/topics for a given board+grade (and optional subject).
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/report-generated-tests.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-04T00:00:00Z | copilot | created investigative reporting script
 */

import { prisma } from '../lib/prisma'

type Args = {
  board?: string
  grade?: number
  subject?: string
}

function parseArgs(): Args {
  const out: Args = {}
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--board' && argv[i + 1]) {
      out.board = argv[++i]
    } else if (a === '--grade' && argv[i + 1]) {
      out.grade = Number(argv[++i])
    } else if (a === '--subject' && argv[i + 1]) {
      out.subject = argv[++i]
    }
  }
  return out
}

async function report(opts: Args) {
  if (!opts.board || !opts.grade) {
    console.error('Usage: tsx scripts/report-generated-tests.ts --board <boardSlug> --grade <grade> [--subject <subjectSlug>]')
    process.exit(1)
  }

  // Find subjects matching board+grade (or narrow to a single subject)
  const subjects = await prisma.subjectDef.findMany({
    where: {
      lifecycle: 'active',
      ...(opts.subject ? { slug: opts.subject } : {}),
      class: {
        lifecycle: 'active',
        grade: opts.grade,
        board: { lifecycle: 'active', slug: { equals: opts.board, mode: 'insensitive' } },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      chapters: {
        where: { lifecycle: 'active' },
        select: {
          id: true,
          name: true,
          topics: { where: { lifecycle: 'active' }, select: { id: true, name: true } },
        },
      },
    },
  })

  const output: any[] = []

  for (const subj of subjects) {
    const topicList: { id: string; name: string }[] = []
    for (const ch of subj.chapters) {
      for (const t of ch.topics) topicList.push({ id: t.id, name: t.name })
    }

    const subjectSummary: any = {
      board: opts.board,
      grade: opts.grade,
      subjectId: subj.id,
      subjectSlug: subj.slug,
      subjectName: subj.name,
      chapters: subj.chapters.length,
      topics: topicList.length,
      topicsDetail: [] as any[],
    }

    // aggregate totals
    let totalGeneratedTests = 0
    let totalGeneratedQuestions = 0
    let totalQuestionBank = 0

    for (const topic of topicList) {
      const genTests = await prisma.generatedTest.findMany({
        where: { topicId: topic.id },
        select: { id: true, difficulty: true, language: true, version: true, status: true, createdAt: true, questions: { select: { id: true, type: true, question: true, options: true } } },
      })

      const genTestCount = genTests.length
      const genQuestionCount = genTests.reduce((s, t) => s + (t.questions?.length ?? 0), 0)
      const questionBankCount = await prisma.question.count({ where: { topicId: topic.id } })

      totalGeneratedTests += genTestCount
      totalGeneratedQuestions += genQuestionCount
      totalQuestionBank += questionBankCount

      // quick validation flags: tests with zero questions, questions with <2 options
      const problematicTests: any[] = []
      for (const t of genTests) {
        const qCount = t.questions?.length ?? 0
        const badQSample = (t.questions ?? []).filter((q: any) => {
          try {
            const opts = q.options
            if (!opts) return true
            if (Array.isArray(opts)) return opts.length < 2
            if (typeof opts === 'object') return Object.keys(opts).length < 2
            return true
          } catch {
            return true
          }
        })
        if (qCount === 0 || badQSample.length > 0) {
          problematicTests.push({ testId: t.id, qCount, badQuestions: badQSample.length, difficulty: t.difficulty, language: t.language })
        }
      }

      subjectSummary.topicsDetail.push({
        topicId: topic.id,
        topicName: topic.name,
        generatedTestCount: genTestCount,
        generatedQuestionCount: genQuestionCount,
        questionBankCount,
        problematicTests,
      })
    }

    subjectSummary.totals = {
      generatedTests: totalGeneratedTests,
      generatedQuestions: totalGeneratedQuestions,
      questionBank: totalQuestionBank,
    }

    output.push(subjectSummary)
  }

  await prisma.$disconnect()

  // Print JSON for inspection; caller can pipe to file
  console.log(JSON.stringify(output, null, 2))
}

if (require.main === module) {
  const args = parseArgs()
  report(args).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Report failed:', err)
    prisma.$disconnect().finally(() => process.exit(1))
  })
}
