import { saveCoursePackage } from '@/lib/course/package/store'
import { PrismaClient } from '@prisma/client'

const makePkg = () => ({
  id: 'pkg1',
  syllabusId: 's1',
  version: 1,
  title: 'Course Title',
  description: 'd',
  modules: [
    {
      moduleId: 'm1',
      title: 'Module One',
      lessons: [
        {
          id: 'l1',
          syllabusId: 's1',
          moduleId: 'm1',
          lessonIndex: 1,
          title: 'Lesson One',
          durationMinutes: 10,
          objectives: ['o'],
          explanation: { overview: 'overview'.repeat(10), concepts: [{ title: 'c1', explanation: 'This concept explanation is long enough to satisfy the schema minimum length requirement.' }] },
          keyTakeaways: ['t1','t2'],
          practice: { prompt: 'p'.repeat(30), expectedOutcome: 'o'.repeat(30) },
          metadata: { level: 'beginner' }
        }
      ],
      quizzes: [
        { lessonId: 'l1', questions: [{ question: 'What is X?', options: ['A','B','C','D'], correctIndex: 0, explanation: 'This explanation is sufficiently long.' }] }
      ]
    }
  ],
  createdAt: new Date().toISOString(),
  frozen: true
})

test('saveCoursePackage succeeds on valid insert', async () => {
  const mockPrisma: any = {
    coursePackage: {
      create: jest.fn().mockResolvedValueOnce({ ok: true })
    }
  }

  const pkg = makePkg() as any
  const res = await saveCoursePackage(mockPrisma as PrismaClient, pkg)
  expect(mockPrisma.coursePackage.create).toHaveBeenCalled()
  expect(res).toEqual({ ok: true })
})

test('saveCoursePackage bubbles unique-constraint errors (duplicate version)', async () => {
  const mockPrisma: any = {
    coursePackage: {
      create: jest.fn().mockRejectedValueOnce(Object.assign(new Error('Unique'), { code: 'P2002' }))
    }
  }

  const pkg = makePkg() as any
  await expect(saveCoursePackage(mockPrisma as PrismaClient, pkg)).rejects.toThrow()
  expect(mockPrisma.coursePackage.create).toHaveBeenCalled()
})
