import { saveCoursePackage } from '../../lib/course/package/store'
import { PrismaClient } from '@prisma/client'

const makePkg = () => ({
  id: 'pkg1',
  syllabusId: 's1',
  version: 1,
  title: 'T',
  description: 'd',
  modules: [],
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
