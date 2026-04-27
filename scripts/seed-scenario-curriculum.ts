/**
 * Seed script: 2 subjects, 2 chapters each, 2 topics each (8 topics total).
 * For each topic: 1 TopicNote (approved, active), 3 Questions (easy, medium, hard),
 * 1 GeneratedTest (medium) with 3 GeneratedQuestions.
 *
 * Students and scenario data for engine validation:
 *   A -- fresh@scenario.test       : no sessions, no homework, no progress → P5 next_new_topic
 *   B -- midsession@scenario.test  : StructuredSession state PRACTICE       → P1 resume_session
 *   C -- weak@scenario.test        : StudentTopicMastery accuracy < 0.6,   → P4 low_accuracy
 *                                   StudentTopicProgress practiceCount > 5
 *   D -- spaced@scenario.test      : mastery 0.65, lastStudiedAt 7 days ago → P3 spaced_revision (Phase-2)
 *   E -- homework@scenario.test   : HomeworkAssignment PENDING, due < 48h → P0 homework_pending (Phase-2)
 *   P2 -- daily@scenario.test      : DailyTask today, pending               → P2 daily_task
 *
 * Run: npx tsx scripts/seed-scenario-curriculum.ts
 */
import { prisma } from '../lib/prisma';



/** UTC midnight today for DailyTask date */
function utcMidnightToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const SUBJECTS = [
  { name: 'Mathematics', slug: 'math' },
  { name: 'Science', slug: 'science' },
];

const CHAPTERS_PER_SUBJECT = [
  { name: 'Number Systems', slug: 'number-systems', order: 1 },
  { name: 'Algebra Basics', slug: 'algebra-basics', order: 2 },
];
const SCIENCE_CHAPTERS = [
  { name: 'Living Organisms', slug: 'living-organisms', order: 1 },
  { name: 'Matter', slug: 'matter', order: 2 },
];

const TOPICS_PER_CHAPTER = [
  { name: 'Integers', slug: 'integers', order: 1 },
  { name: 'Rational Numbers', slug: 'rational-numbers', order: 2 },
];

function topicName(subject: string, chapter: string, topic: string): string {
  return `${subject} - ${chapter} - ${topic}`;
}

async function main() {
  console.log('Seeding scenario curriculum: 2 subjects, 2 chapters each, 2 topics each...');

  const board = await prisma.board.upsert({
    where: { slug: 'cbse' },
    create: { name: 'CBSE', slug: 'cbse' },
    update: {},
  });
  const classLevel = await prisma.classLevel.upsert({
    where: { boardId_grade: { boardId: board.id, grade: 10 } },
    create: { grade: 10, slug: 'grade-10', boardId: board.id },
    update: {},
  });

  const topicIds: string[] = [];
  const topicMeta: { topicId: string; subject: string; chapter: string }[] = [];
  const subjectNames = SUBJECTS.map((s) => s.name);

  for (let sIdx = 0; sIdx < SUBJECTS.length; sIdx++) {
    const subj = SUBJECTS[sIdx];
    const subject = await prisma.subjectDef.upsert({
      where: { classId_slug: { classId: classLevel.id, slug: subj.slug } },
      create: { name: subj.name, slug: subj.slug, classId: classLevel.id },
      update: {},
    });
    const chaptersConfig = subj.slug === 'science' ? SCIENCE_CHAPTERS : CHAPTERS_PER_SUBJECT;

    for (let cIdx = 0; cIdx < chaptersConfig.length; cIdx++) {
      const ch = chaptersConfig[cIdx];
      const chapter = await prisma.chapterDef.upsert({
        where: {
          subjectId_slug_version: { subjectId: subject.id, slug: ch.slug, version: 1 },
        },
        create: {
          name: ch.name,
          slug: ch.slug,
          order: ch.order,
          version: 1,
          subjectId: subject.id,
        },
        update: {},
      });

      for (let tIdx = 0; tIdx < TOPICS_PER_CHAPTER.length; tIdx++) {
        const tp = TOPICS_PER_CHAPTER[tIdx];
        const topic = await prisma.topicDef.upsert({
          where: { chapterId_slug: { chapterId: chapter.id, slug: tp.slug } },
          create: {
            name: tp.name,
            slug: tp.slug,
            order: tp.order,
            chapterId: chapter.id,
            lifecycle: 'active',
          },
          update: { lifecycle: 'active' },
        });
        topicIds.push(topic.id);
        topicMeta.push({ topicId: topic.id, subject: subj.name, chapter: ch.name });

        const title = topicName(subj.name, ch.name, tp.name);
        await prisma.topicNote.upsert({
          where: {
            topicId_language_version: { topicId: topic.id, language: 'en', version: 1 },
          },
          create: {
            topicId: topic.id,
            language: 'en',
            title,
            contentJson: { summary: `Notes for ${title}`, keyPoints: ['Point 1', 'Point 2'] },
            source: 'seed',
            status: 'approved',
            lifecycle: 'active',
          },
          update: { status: 'approved', lifecycle: 'active' },
        });

        const existingQuestionCount = await prisma.question.count({
          where: { topicId: topic.id },
        });
        if (existingQuestionCount < 3) {
          for (const diff of ['easy', 'medium', 'hard'] as const) {
            await prisma.question.create({
              data: {
                topicId: topic.id,
                subject: subj.name,
                chapter: ch.name,
                grade: '10',
                board: 'cbse',
                type: 'mcq',
                difficulty: diff,
                prompt: `What is the main concept in ${tp.name}? (${diff})`,
                choices: ['A', 'B', 'C', 'D'],
                correctAnswer: 'A',
                source: 'seed',
              },
            });
          }
        }

        const existingTest = await prisma.generatedTest.findFirst({
          where: { topicId: topic.id, lifecycle: 'active' },
        });
        if (!existingTest) {
          const test = await prisma.generatedTest.create({
            data: {
              topicId: topic.id,
              title: `Test: ${tp.name}`,
              difficulty: 'medium',
              language: 'en',
              status: 'approved',
              lifecycle: 'active',
            },
          });
          for (let q = 1; q <= 3; q++) {
            await prisma.generatedQuestion.create({
              data: {
                testId: test.id,
                type: 'mcq',
                question: `Sample question ${q} for ${tp.name}`,
                options: ['A', 'B', 'C', 'D'],
                answer: { final_answer: 'A' },
                explanation: `Explanation for question ${q}`,
              },
            });
          }
        }
      }
    }
  }

  const studentPayload = [
    { name: 'Fresh Student', email: 'fresh@scenario.test', role: 'user' as const },
    { name: 'Mid-Session Student', email: 'midsession@scenario.test', role: 'user' as const },
    { name: 'Weak Topic Student', email: 'weak@scenario.test', role: 'user' as const },
    { name: 'Spaced Revision Student', email: 'spaced@scenario.test', role: 'user' as const },
    { name: 'Homework Pending Student', email: 'homework@scenario.test', role: 'user' as const },
    { name: 'Daily Task Student', email: 'daily@scenario.test', role: 'user' as const },
  ];

  const students: { id: string; email: string }[] = [];
  for (const s of studentPayload) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      create: {
        name: s.name,
        email: s.email,
        language: 'en',
        board: 'cbse',
        grade: '10',
        subjects: subjectNames,
        role: s.role,
      },
      update: { board: 'cbse', grade: '10', subjects: subjectNames },
    });
    students.push({ id: user.id, email: user.email! });
  }

  const firstTopicId = topicIds[0];
  const secondTopicId = topicIds[1];
  const firstMeta = topicMeta[0];
  const secondMeta = topicMeta[1];

  const getStudentId = (email: string) => students.find((s) => s.email === email)!.id;

  // ---- Scenario A: Fresh -- ensure no sessions, homework, or progress (P5 next_new_topic)
  const freshId = getStudentId('fresh@scenario.test');
  await prisma.structuredSession.deleteMany({ where: { studentId: freshId } });
  await prisma.learningSession.deleteMany({ where: { studentId: freshId } });
  await prisma.studentTopicMastery.deleteMany({ where: { studentId: freshId } });
  await prisma.studentTopicProgress.deleteMany({ where: { studentId: freshId } });
  await prisma.attentionFlag.deleteMany({ where: { studentId: freshId } });
  await prisma.homeworkAssignment.deleteMany({ where: { studentId: freshId } });

  // ---- Scenario B: Mid-session -- StructuredSession state PRACTICE → P1 resume_session
  const midsessionId = getStudentId('midsession@scenario.test');
  await prisma.structuredSession.deleteMany({ where: { studentId: midsessionId } });
  await prisma.structuredSession.create({
    data: {
      studentId: midsessionId,
      topicId: firstTopicId,
      state: 'PRACTICE',
      startedAt: new Date(),
    },
  });

  // ---- Scenario C: Weak topic -- P4 low_accuracy (mastery < 0.6, practiceCount > 5)
  const weakId = getStudentId('weak@scenario.test');
  await prisma.studentTopicMastery.deleteMany({ where: { studentId: weakId } });
  await prisma.studentTopicProgress.deleteMany({ where: { studentId: weakId } });
  await prisma.studentTopicMastery.upsert({
    where: { studentId_topicId: { studentId: weakId, topicId: secondTopicId } },
    create: {
      studentId: weakId,
      topicId: secondTopicId,
      subject: secondMeta.subject,
      chapter: secondMeta.chapter,
      masteryLevel: 'beginner',
      accuracy: 0.35,
    },
    update: { accuracy: 0.35 },
  });
  await prisma.studentTopicProgress.upsert({
    where: { studentId_topicId: { studentId: weakId, topicId: secondTopicId } },
    create: {
      studentId: weakId,
      topicId: secondTopicId,
      mastery: 0.35,
      practiceCount: 6,
      lastStudiedAt: new Date(),
    },
    update: { mastery: 0.35, practiceCount: 6 },
  });

  // ---- Scenario D: Spaced revision -- mastery 0.65, lastStudiedAt 7 days ago (Phase-2 P3)
  const spacedId = getStudentId('spaced@scenario.test');
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.studentTopicMastery.deleteMany({ where: { studentId: spacedId } });
  await prisma.studentTopicProgress.deleteMany({ where: { studentId: spacedId } });
  await prisma.studentTopicMastery.upsert({
    where: { studentId_topicId: { studentId: spacedId, topicId: firstTopicId } },
    create: {
      studentId: spacedId,
      topicId: firstTopicId,
      subject: firstMeta.subject,
      chapter: firstMeta.chapter,
      masteryLevel: 'intermediate',
      accuracy: 0.65,
    },
    update: { accuracy: 0.65 },
  });
  await prisma.studentTopicProgress.upsert({
    where: { studentId_topicId: { studentId: spacedId, topicId: firstTopicId } },
    create: {
      studentId: spacedId,
      topicId: firstTopicId,
      mastery: 0.65,
      practiceCount: 5,
      lastStudiedAt: sevenDaysAgo,
    },
    update: { mastery: 0.65, practiceCount: 5, lastStudiedAt: sevenDaysAgo },
  });

  // ---- Scenario E: Homework pending -- PENDING, dueDate < 48h (Phase-2 P0)
  const homeworkId = getStudentId('homework@scenario.test');
  const dueIn24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.homeworkAssignment.deleteMany({ where: { studentId: homeworkId } });
  await prisma.homeworkAssignment.create({
    data: {
      studentId: homeworkId,
      topicId: firstTopicId,
      questions: [],
      status: 'PENDING',
      dueDate: dueIn24h,
    },
  });

  // ---- P2: Daily task -- today, pending → P2 daily_task
  const dailyId = getStudentId('daily@scenario.test');
  const todayStart = utcMidnightToday();
  await prisma.dailyTask.deleteMany({ where: { studentId: dailyId } });
  await prisma.dailyTask.create({
    data: {
      studentId: dailyId,
      date: todayStart,
      taskType: 'practice',
      title: 'Practice Integers',
      description: 'Complete today\'s practice',
      topicId: firstTopicId,
      subject: firstMeta.subject,
      chapter: firstMeta.chapter,
      status: 'pending',
      estimatedTimeMin: 15,
    },
  });

  console.log('Created', topicIds.length, 'topics with notes and questions.');
  console.log('Students:', students.map((s) => s.email).join(', '));
  console.log('Scenario data: B=midsession(PRACTICE), C=weak(low accuracy+progress), D=spaced(7d ago), E=homework(PENDING), P2=daily(pending task).');
  console.log('First topicId:', firstTopicId);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
