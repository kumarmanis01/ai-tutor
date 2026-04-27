import { prisma } from '../lib/prisma'

function daysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

export async function seed() {
  // 1. Upsert user
  const user = await prisma.user.upsert({
    where: { email: 'test@student.com' },
    update: {},
    create: {
      email: 'test@student.com',
      name: 'UI Test Student',
      language: 'en',
    },
  })

  // 2. Upsert StudentLearningProfile (be tolerant to schema variations)
  try {
    await prisma.studentLearningProfile.upsert({
      where: { studentId: user.id },
      update: {
        // Try to set the requested UI fields; if schema lacks them, we'll catch and fallback
        dailyTargetMin: 30 as any,
        studyDaysPerWeek: 5 as any,
        recommendations: {
          learningPath: [
            { key: 'linear-equations', title: 'Linear Equations', order: 1, status: 'completed' },
            { key: 'quadratic-equations', title: 'Quadratic Equations', order: 2, status: 'current' },
            { key: 'polynomials', title: 'Polynomials', order: 3, status: 'pending' },
          ],
        } as any,
      } as any,
      create: {
        studentId: user.id,
        dailyTargetMin: 30 as any,
        studyDaysPerWeek: 5 as any,
        recommendations: {
          learningPath: [
            { key: 'linear-equations', title: 'Linear Equations', order: 1, status: 'completed' },
            { key: 'quadratic-equations', title: 'Quadratic Equations', order: 2, status: 'current' },
            { key: 'polynomials', title: 'Polynomials', order: 3, status: 'pending' },
          ],
        } as any,
      } as any,
    })
  } catch (err) {
    console.warn('studentLearningProfile.upsert failed, attempting tolerant fallback:', err?.message || err)
    // Fallback: try to find existing profile and update strengths/recommendations fields if available
    try {
      const existing = await prisma.studentLearningProfile.findUnique({ where: { studentId: user.id } as any })
      const recommendations = { learningPath: [
        { key: 'linear-equations', title: 'Linear Equations', order: 1, status: 'completed' },
        { key: 'quadratic-equations', title: 'Quadratic Equations', order: 2, status: 'current' },
        { key: 'polynomials', title: 'Polynomials', order: 3, status: 'pending' },
      ] }
      if (existing) {
        await prisma.studentLearningProfile.update({ where: { id: existing.id } as any, data: { strengths: { dailyTargetMin: 30, studyDaysPerWeek: 5 }, recommendations } as any })
      } else {
        await prisma.studentLearningProfile.create({ data: { studentId: user.id, strengths: { dailyTargetMin: 30, studyDaysPerWeek: 5 }, recommendations } as any })
      }
    } catch (err2) {
      console.warn('Fallback create/update also failed for studentLearningProfile:', err2?.message || err2)
    }
  }

  // 3. Create content hierarchy: Board -> ClassLevel -> Subject -> Chapter -> Topics
  const board = await prisma.board.upsert({
    where: { slug: 'default-board' },
    update: {},
    create: { name: 'Default Board', slug: 'default-board' },
  })

  const classLevel = await prisma.classLevel.upsert({
    where: { boardId_grade: { boardId: board.id, grade: 7 } },
    update: {},
    create: { grade: 7, slug: 'grade-7', boardId: board.id },
  })

  const subject = await prisma.subjectDef.upsert({
    where: { classId_slug: { classId: classLevel.id, slug: 'math' } },
    update: {},
    create: { name: 'Math', slug: 'math', classId: classLevel.id },
  })

  const chapter = await prisma.chapterDef.upsert({
    where: { subjectId_slug_version: { subjectId: subject.id, slug: 'algebra', version: 1 } },
    update: {},
    create: { name: 'Algebra', slug: 'algebra', order: 1, subjectId: subject.id },
  })

  // Topics
  const topicsData = [
    { slug: 'linear-equations', name: 'Linear Equations' },
    { slug: 'quadratic-equations', name: 'Quadratic Equations' },
    { slug: 'polynomials', name: 'Polynomials' },
  ]

  const topics = [] as { id: string; slug: string; name: string }[]
  for (const t of topicsData) {
    const topic = await prisma.topicDef.upsert({
      where: { chapterId_slug: { chapterId: chapter.id, slug: t.slug } },
      update: { name: t.name },
      create: { name: t.name, slug: t.slug, order: 1, chapterId: chapter.id },
    })
    topics.push({ id: topic.id, slug: t.slug, name: t.name })
  }

  // 4. StudentTopicMastery records to represent practice attempts / mastery
  // Linear: 85% accuracy (completed)
  const linear = topics.find((x) => x.slug === 'linear-equations')!
  const quadratic = topics.find((x) => x.slug === 'quadratic-equations')!
  const polynomials = topics.find((x) => x.slug === 'polynomials')!

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
    where: { studentId_topicId: { studentId: user.id, topicId: quadratic.id } },
    update: { accuracy: 45, questionsAttempted: 4, masteryLevel: 'beginner', lastAttemptedAt: new Date() },
    create: {
      studentId: user.id,
      topicId: quadratic.id,
      subject: 'Math',
      chapter: 'Algebra',
      accuracy: 45,
      questionsAttempted: 4,
      masteryLevel: 'beginner',
      lastAttemptedAt: new Date(),
    },
  })

  await prisma.studentTopicMastery.upsert({
    where: { studentId_topicId: { studentId: user.id, topicId: polynomials.id } },
    update: { accuracy: 0, questionsAttempted: 0, masteryLevel: 'beginner', lastAttemptedAt: daysAgo(1) },
    create: {
      studentId: user.id,
      topicId: polynomials.id,
      subject: 'Math',
      chapter: 'Algebra',
      accuracy: 0,
      questionsAttempted: 0,
      masteryLevel: 'beginner',
      lastAttemptedAt: daysAgo(1),
    },
  })

  // 5. Insert one in-progress LearningSession for Quadratic
  await prisma.learningSession.createMany({
    data: [
      {
        studentId: user.id,
        activityType: 'practice_session',
        activityRef: quadratic.id,
        duration: null,
        isCompleted: false,
        difficultyLevel: 'medium',
        startedAt: new Date(),
        completionPercentage: 10,
      },
    ],
    skipDuplicates: true,
  })

  // 6. Insert three student topic activity rows as LearningSession entries (safe for re-run)
  await prisma.learningSession.createMany({
    data: [
      { studentId: user.id, activityType: 'topic_activity', activityRef: linear.id, startedAt: daysAgo(2), endedAt: daysAgo(2), difficultyLevel: 'medium' },
      { studentId: user.id, activityType: 'topic_activity', activityRef: polynomials.id, startedAt: daysAgo(1), endedAt: daysAgo(1), difficultyLevel: 'medium' },
      { studentId: user.id, activityType: 'topic_activity', activityRef: quadratic.id, startedAt: new Date(), endedAt: null, difficultyLevel: 'medium' },
    ],
    skipDuplicates: true,
  })

  console.log('Seed complete for UI test student:', user.email)
}

// ESM-compatible entry check: run when this file is invoked directly.
const argvPath = process.argv[1] || ''
if (argvPath.includes('seed-ui-test-data')) {
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
