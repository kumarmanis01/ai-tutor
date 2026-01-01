import { PrismaClient } from '@prisma/client'
import validateCoursePackage from './schema'
import type { CoursePackage as CP } from './types'

/**
 * Persist a CoursePackage as an insert-only row.
 * Caller is expected to validate/construct `pkg` using `buildCoursePackage` and zod.
 */
export async function saveCoursePackage(prisma: PrismaClient, pkg: CP) {
  // validate shape before persisting
  validateCoursePackage(pkg)

  return prisma.coursePackage.create({
    data: {
      syllabusId: pkg.syllabusId,
      version: pkg.version,
      json: pkg as any
    }
  })
}

export async function getCoursePackagesBySyllabus(prisma: PrismaClient, syllabusId: string) {
  return prisma.coursePackage.findMany({
    where: { syllabusId },
    orderBy: { version: 'desc' }
  })
}

const CoursePackageStore = { saveCoursePackage, getCoursePackagesBySyllabus }
export { CoursePackageStore }
export default CoursePackageStore
