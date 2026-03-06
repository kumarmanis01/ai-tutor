import { PrismaClient } from '@prisma/client'

// Local alias for the MasteryLevel enum to avoid depending on a freshly
// generated Prisma client during editor/type-check time.
type MasteryLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert'

const prisma = new PrismaClient()

function daysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

async function upsertCurriculum() {
  // Board and class
  const board = await prisma.board.upsert({ where: { slug: 'default-board' }, update: {}, create: { name: 'Default Board', slug: 'default-board' } })
  const class7 = await prisma.classLevel.upsert({ where: { boardId_grade: { boardId: board.id, grade: 7 } }, update: {}, create: { grade: 7, slug: 'grade-7', boardId: board.id } })

  // Subjects
  const subjects = {}
  const math = await prisma.subjectDef.upsert({ where: { classId_slug: { classId: class7.id, slug: 'math' } }, update: {}, create: { name: 'Math', slug: 'math', classId: class7.id } })
  const science = await prisma.subjectDef.upsert({ where: { classId_slug: { classId: class7.id, slug: 'science' } }, update: {}, create: { name: 'Science', slug: 'science', classId: class7.id } })
  subjects['Math'] = math
  subjects['Science'] = science

  // Chapters and topics mapping
  const chapters: Record<string, any> = {}

  // Math chapters
  const algebra = await prisma.chapterDef.upsert({ where: { subjectId_slug_version: { subjectId: math.id, slug: 'algebra', version: 1 } }, update: {}, create: { name: 'Algebra', slug: 'algebra', order: 1, subjectId: math.id } })
  const geometry = await prisma.chapterDef.upsert({ where: { subjectId_slug_version: { subjectId: math.id, slug: 'geometry', version: 1 } }, update: {}, create: { name: 'Geometry', slug: 'geometry', order: 2, subjectId: math.id } })
  chapters['Algebra'] = algebra
  chapters['Geometry'] = geometry

  // Science chapters
  const physics = await prisma.chapterDef.upsert({ where: { subjectId_slug_version: { subjectId: science.id, slug: 'physics-basics', version: 1 } }, update: {}, create: { name: 'Physics Basics', slug: 'physics-basics', order: 1, subjectId: science.id } })
  const chemistry = await prisma.chapterDef.upsert({ where: { subjectId_slug_version: { subjectId: science.id, slug: 'chemistry-basics', version: 1 } }, update: {}, create: { name: 'Chemistry Basics', slug: 'chemistry-basics', order: 2, subjectId: science.id } })
  chapters['Physics Basics'] = physics
  chapters['Chemistry Basics'] = chemistry

  // Topics per chapter
  const topicMap: Record<string, any[]> = {}

  async function createTopics(chapter: any, topics: { slug: string; name: string }[]) {
    const arr: any[] = []
    for (const t of topics) {
      const topic = await prisma.topicDef.upsert({ where: { chapterId_slug: { chapterId: chapter.id, slug: t.slug } }, update: { name: t.name }, create: { name: t.name, slug: t.slug, order: 1, chapterId: chapter.id } })
      arr.push(topic)
    }
    return arr
  }

  topicMap['Algebra'] = await createTopics(algebra, [
    { slug: 'linear-equations', name: 'Linear Equations' },
    { slug: 'quadratic-equations', name: 'Quadratic Equations' },
    { slug: 'polynomials', name: 'Polynomials' },
  ])

  topicMap['Geometry'] = await createTopics(geometry, [
    { slug: 'triangles', name: 'Triangles' },
    { slug: 'circles', name: 'Circles' },
    { slug: 'coordinate-geometry', name: 'Coordinate Geometry' },
  ])

  topicMap['Physics Basics'] = await createTopics(physics, [
    { slug: 'motion', name: 'Motion' },
    { slug: 'force', name: 'Force' },
    { slug: 'work-energy', name: 'Work & Energy' },
  ])

  topicMap['Chemistry Basics'] = await createTopics(chemistry, [
    { slug: 'atoms', name: 'Atoms' },
    { slug: 'molecules', name: 'Molecules' },
    { slug: 'chemical-reactions', name: 'Chemical Reactions' },
  ])

  return { board, class7, subjects, chapters, topicMap }
}

async function seedStudentWeak(userEmail: string, topicMap: Record<string, any[]>) {
  const user = await prisma.user.upsert({ where: { email: userEmail }, update: {}, create: { email: userEmail, name: 'Weak Student', language: 'en' } })

  // Student profile upsert tolerant
  try {
    await prisma.studentLearningProfile.upsert({ where: { studentId: user.id }, update: { dailyTargetMin: 30, studyDaysPerWeek: 5, recommendations: { learningPath: [{ key: 'linear-equations' }, { key: 'quadratic-equations' }, { key: 'polynomials' }] } as any }, create: { studentId: user.id, dailyTargetMin: 30, studyDaysPerWeek: 5, recommendations: { learningPath: [{ key: 'linear-equations' }, { key: 'quadratic-equations' }, { key: 'polynomials' }] } as any } })
  } catch (err) {
    // fallback
    const recommendations = { learningPath: [{ key: 'linear-equations' }, { key: 'quadratic-equations' }, { key: 'polynomials' }] }
    const existing = await prisma.studentLearningProfile.findUnique({ where: { studentId: user.id } as any })
    if (existing) {
      await prisma.studentLearningProfile.update({ where: { id: existing.id } as any, data: { strengths: { dailyTargetMin: 30, studyDaysPerWeek: 5 }, recommendations } as any })
    } else {
      await prisma.studentLearningProfile.create({ data: { studentId: user.id, strengths: { dailyTargetMin: 30, studyDaysPerWeek: 5 }, recommendations } as any })
    }
  }

  // Map topics
  const linear = topicMap['Algebra'].find((t: any) => t.slug === 'linear-equations')
  const quad = topicMap['Algebra'].find((t: any) => t.slug === 'quadratic-equations')
  const poly = topicMap['Algebra'].find((t: any) => t.slug === 'polynomials')

  // Mastery / practice attempts
  await prisma.studentTopicMastery.upsert({
    where: { studentId_topicId: { studentId: user.id, topicId: linear.id } },
    update: { accuracy: 85, questionsAttempted: 10, masteryLevel: 'advanced', lastAttemptedAt: daysAgo(2) },
    create: {
      studentId: user.id,
      topicId: linear.id,
      subject: 'Math',
      chapter: 'Algebra',
      accuracy: 85,
      questionsAttempted: 10,
      masteryLevel: 'advanced',
      lastAttemptedAt: daysAgo(2),
    },
  })

  await prisma.studentTopicMastery.upsert({
    where: { studentId_topicId: { studentId: user.id, topicId: quad.id } },
    update: { accuracy: 40, questionsAttempted: 5, masteryLevel: 'beginner', lastAttemptedAt: new Date() },
    create: {
      studentId: user.id,
      topicId: quad.id,
      subject: 'Math',
      chapter: 'Algebra',
      accuracy: 40,
      questionsAttempted: 5,
      masteryLevel: 'beginner',
      lastAttemptedAt: new Date(),
    },
  })

  // No science progress

  // In-progress learning session for Quadratic
  const existingSession = await prisma.learningSession.findFirst({ where: { studentId: user.id, activityType: 'practice_session', activityRef: quad.id, isCompleted: false } })
  if (!existingSession) {
    await prisma.learningSession.create({ data: { studentId: user.id, activityType: 'practice_session', activityRef: quad.id, difficultyLevel: 'medium', isCompleted: false, startedAt: new Date(), completionPercentage: 20 } })
  }

  // Recent topic activity
  await prisma.learningSession.createMany({ data: [ { studentId: user.id, activityType: 'topic_activity', activityRef: linear.id, startedAt: daysAgo(2), endedAt: daysAgo(2), difficultyLevel: 'medium' }, { studentId: user.id, activityType: 'topic_activity', activityRef: poly.id, startedAt: daysAgo(1), endedAt: daysAgo(1), difficultyLevel: 'medium' }, { studentId: user.id, activityType: 'topic_activity', activityRef: quad.id, startedAt: new Date(), endedAt: null, difficultyLevel: 'medium' } ], skipDuplicates: true })
}

async function seedStudentActive(userEmail: string, topicMap: Record<string, any[]>) {
  const user = await prisma.user.upsert({ where: { email: userEmail }, update: {}, create: { email: userEmail, name: 'Active Student', language: 'en' } })

  try {
    await prisma.studentLearningProfile.upsert({ where: { studentId: user.id }, update: { dailyTargetMin: 45, studyDaysPerWeek: 6, recommendations: { learningPath: [] } as any }, create: { studentId: user.id, dailyTargetMin: 45, studyDaysPerWeek: 6, recommendations: { learningPath: [] } as any } })
  } catch (err) {
    const recommendations = { learningPath: [] }
    const existing = await prisma.studentLearningProfile.findUnique({ where: { studentId: user.id } as any })
    if (existing) {
      await prisma.studentLearningProfile.update({ where: { id: existing.id } as any, data: { strengths: { dailyTargetMin: 45, studyDaysPerWeek: 6 }, recommendations } as any })
    } else {
      await prisma.studentLearningProfile.create({ data: { studentId: user.id, strengths: { dailyTargetMin: 45, studyDaysPerWeek: 6 }, recommendations } as any })
    }
  }

  // Complete Algebra topics
  for (const t of topicMap['Algebra']) {
    await prisma.studentTopicMastery.upsert({ where: { studentId_topicId: { studentId: user.id, topicId: t.id } }, update: { accuracy: 80 + Math.floor(Math.random() * 11), questionsAttempted: 15, masteryLevel: 'intermediate' as MasteryLevel, lastAttemptedAt: daysAgo(Math.floor(Math.random() * 5)) }, create: { studentId: user.id, topicId: t.id, subject: 'Math', chapter: 'Algebra', accuracy: 80 + Math.floor(Math.random() * 11), questionsAttempted: 15, masteryLevel: 'intermediate' as MasteryLevel, lastAttemptedAt: daysAgo(Math.floor(Math.random() * 5)) } })
  }

  // Science Motion current
  const motion = topicMap['Physics Basics'].find((t: any) => t.slug === 'motion')
  await prisma.studentTopicMastery.upsert({ where: { studentId_topicId: { studentId: user.id, topicId: motion.id } }, update: { accuracy: 70, questionsAttempted: 8, masteryLevel: 'intermediate' as MasteryLevel, lastAttemptedAt: new Date() }, create: { studentId: user.id, topicId: motion.id, subject: 'Science', chapter: 'Physics Basics', accuracy: 70, questionsAttempted: 8, masteryLevel: 'intermediate' as MasteryLevel, lastAttemptedAt: new Date() } })

  // Recent activity for 5 topics (mix)
  const activityTopics = [ topicMap['Algebra'][0], topicMap['Algebra'][1], topicMap['Algebra'][2], topicMap['Physics Basics'][0], topicMap['Chemistry Basics'][0] ]
  for (const t of activityTopics) {
    await prisma.learningSession.createMany({ data: [ { studentId: user.id, activityType: 'topic_activity', activityRef: t.id, startedAt: daysAgo(Math.floor(Math.random() * 5)), endedAt: daysAgo(Math.floor(Math.random() * 5)), difficultyLevel: 'easy' } ], skipDuplicates: true })
  }
}

async function seedStudentNew(userEmail: string) {
  const user = await prisma.user.upsert({ where: { email: userEmail }, update: {}, create: { email: userEmail, name: 'New Student', language: 'en' } })

  try {
    await prisma.studentLearningProfile.upsert({ where: { studentId: user.id }, update: { dailyTargetMin: 20, studyDaysPerWeek: 3, recommendations: { learningPath: [] } as any }, create: { studentId: user.id, dailyTargetMin: 20, studyDaysPerWeek: 3, recommendations: { learningPath: [] } as any } })
  } catch (err) {
    const recommendations = { learningPath: [] }
    const existing = await prisma.studentLearningProfile.findUnique({ where: { studentId: user.id } as any })
    if (existing) {
      await prisma.studentLearningProfile.update({ where: { id: existing.id } as any, data: { strengths: { dailyTargetMin: 20, studyDaysPerWeek: 3 }, recommendations } as any })
    } else {
      await prisma.studentLearningProfile.create({ data: { studentId: user.id, strengths: { dailyTargetMin: 20, studyDaysPerWeek: 3 }, recommendations } as any })
    }
  }
}

export async function seed() {
  console.log('Seeding multi-student UI test data...')
  const curriculum = await upsertCurriculum()
  const topicMap = curriculum.topicMap

  // Seed students in a transaction per student where possible
  await seedStudentWeak('weak@student.com', topicMap)
  await seedStudentActive('active@student.com', topicMap)
  await seedStudentNew('new@student.com')

  // Validation logs
  const studentCount = await prisma.user.count({ where: { email: { in: ['weak@student.com', 'active@student.com', 'new@student.com'] } } })
  const topicCount = await prisma.topicDef.count({ where: { slug: { in: Object.values(topicMap).flat().map((t: any) => t.slug) } } })
  const practiceAttemptCount = await prisma.studentTopicMastery.count({ where: { studentId: { in: await prisma.user.findMany({ where: { email: { in: ['weak@student.com', 'active@student.com', 'new@student.com'] } }, select: { id: true } }).then((r) => r.map((x) => x.id)) } } })
  const activeSessions = await prisma.learningSession.count({ where: { studentId: { in: await prisma.user.findMany({ where: { email: { in: ['weak@student.com', 'active@student.com', 'new@student.com'] } }, select: { id: true } }).then((r) => r.map((x) => x.id)) }, isCompleted: false } })

  console.log('Validation:')
  console.log('- Students seeded:', studentCount)
  console.log('- Topics present:', topicCount)
  console.log('- PracticeAttempt (studentTopicMastery) count for seeded students:', practiceAttemptCount)
  console.log('- Active (in-progress) sessions for seeded students:', activeSessions)

  console.log('Seeding finished.')
}

// ESM-friendly direct-run check
if ((process.argv[1] || '').includes('seed-multi-ui-test-data')) {
  seed()
    .catch((e) => {
      console.error(e)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}

export default seed
