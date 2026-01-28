import handleSyllabusJob from '@/worker/services/syllabusWorker'
import { hydrateNotes } from '@/hydrators/hydrateNotes'
import { hydrateQuestions } from '@/hydrators/hydrateQuestions'
import { assembleTest } from '@/hydrators/assembleTest'

jest.mock('@/lib/callLLM', () => ({ callLLM: jest.fn() }))
jest.mock('@/lib/slug', () => ({ toSlug: (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-') }))
jest.mock('@/lib/getNextVersion', () => ({ getNextVersion: jest.fn().mockResolvedValue(2) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    hydrationJob: { updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    systemSetting: { findUnique: jest.fn() },
    chapterDef: { findFirst: jest.fn() },
    subjectDef: { findUnique: jest.fn() },
    topicDef: { findUnique: jest.fn() },
    topicNote: { findFirst: jest.fn(), create: jest.fn() },
    generatedTest: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    generatedQuestion: { create: jest.fn() },
    executionJob: { findFirst: jest.fn(), update: jest.fn() },
    jobExecutionLog: { create: jest.fn() },
    $transaction: jest.fn()
  }
}))

import { prisma } from '@/lib/prisma'
import { callLLM } from '@/lib/callLLM'

describe('Full hydration flow: syllabus -> notes -> questions -> assembleTest', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('generates syllabus, topics, notes and questions and approves test', async () => {
    // Setup syllabus worker mocks
    ;(prisma.hydrationJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.hydrationJob.findUnique as jest.Mock).mockResolvedValue({ id: 'job-1', subjectId: 'sub-1', board: 'CBSE', grade: 5, language: 'en' })
    ;(prisma.systemSetting.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.chapterDef.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.subjectDef.findUnique as jest.Mock).mockResolvedValue({ id: 'sub-1', name: 'Mathematics' })

    const syllabusJson = { chapters: [ { title: 'Number System', order: 1, topics: [ { title: 'Integers', order: 1 }, { title: 'Fractions', order: 2 } ] }, { title: 'Geometry', order: 2, topics: [ { title: 'Lines', order: 1 } ] } ] }
    ;(callLLM as jest.Mock).mockResolvedValueOnce({ content: JSON.stringify(syllabusJson) })

    // tx mock for syllabus transaction
    const tx = {
      chapterDef: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'chap-1', name: 'Number System' }) },
      topicDef: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'topic-1', name: 'Integers' }) },
      hydrationJob: { update: jest.fn().mockResolvedValue({}) },
      executionJob: { findFirst: jest.fn().mockResolvedValue({ id: 'exec-1', status: 'pending' }), update: jest.fn().mockResolvedValue({}) },
      jobExecutionLog: { create: jest.fn().mockResolvedValue({}) }
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(tx))

    // Run syllabus worker
    await handleSyllabusJob('job-1')

    expect(tx.chapterDef.create).toHaveBeenCalled()
    expect(tx.topicDef.create).toHaveBeenCalled()
    expect(tx.hydrationJob.update).toHaveBeenCalled()

    // Now mock topic lookup for hydrateNotes/hydrateQuestions
    ;(prisma.topicDef.findUnique as jest.Mock).mockResolvedValue({ id: 'topic-1', name: 'Integers', chapter: { id: 'chap-1', subject: { id: 'sub-1', name: 'Mathematics', class: { grade: 5, board: { name: 'CBSE' } } } } })

    // Mock callLLM for notes
    const notesJson = { title: 'Integers - Notes', content: { overview: 'Basics of integers' } }
    ;(callLLM as jest.Mock).mockResolvedValueOnce({ content: JSON.stringify(notesJson) })

    ;(prisma.topicNote.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.topicNote.create as jest.Mock).mockResolvedValue({ id: 'note-1' })

    await hydrateNotes('topic-1', 'en')

    expect(prisma.topicNote.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: 'Integers - Notes' }) }))

    // Mock callLLM for questions (difficulty: medium)
    const questionsJson = { questions: [ { type: 'mcq', question: 'What is 2+2?', options: ['3','4','5'], answer: '4' }, { type: 'mcq', question: 'What is -1 + 1?', options: ['0','1','-1'], answer: '0' }, { type: 'mcq', question: 'Which is even?', options: ['3','4','5'], answer: '4' }, { type: 'mcq', question: 'Integer between 1 and 3?', options: ['1','2','4'], answer: '2' }, { type: 'mcq', question: 'Add 10 and 5', options: ['15','14','16'], answer: '15' } ] }
    ;(callLLM as jest.Mock).mockResolvedValueOnce({ content: JSON.stringify(questionsJson) })

    ;(prisma.generatedTest.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.generatedTest.create as jest.Mock).mockResolvedValue({ id: 'test-1' })
    ;(prisma.generatedQuestion.create as jest.Mock).mockResolvedValue({})

    await hydrateQuestions('topic-1', 'medium' as any, 'en' as any)

    expect(prisma.generatedTest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: expect.stringContaining('Integers') }) }))
    expect(prisma.generatedQuestion.create).toHaveBeenCalled()

    // Now simulate assembleTest approving the test when >=5 questions
    ;(prisma.generatedTest.findMany as jest.Mock).mockResolvedValue([{ id: 'test-1', questions: [1,2,3,4,5] }])
    ;(prisma.generatedTest.update as jest.Mock).mockResolvedValue({})

    await assembleTest('topic-1')

    expect(prisma.generatedTest.update).toHaveBeenCalledWith({ where: { id: 'test-1' }, data: { status: 'approved' } })
  })
})
