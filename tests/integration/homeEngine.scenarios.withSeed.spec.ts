/**
 * Scenario tests with full seed: 2 subjects, 2 chapters each, 2 topics each,
 * with notes and questions by difficulty per topic. Uses 3 dummy students.
 *
 * Run after seeding (or this file creates data in beforeAll):
 *   npx tsx scripts/seed-scenario-curriculum.ts
 *   npx vitest run tests/integration/homeEngine.scenarios.withSeed.spec.ts
 *
 * If run without seed script, beforeAll creates the same curriculum and 3 students.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { readFileSync } from 'fs';
import { register } from 'tsconfig-paths';

try {
  const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json');
  const tsConfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
  const baseUrl = path.resolve(process.cwd(), tsConfig.compilerOptions?.baseUrl ?? '.');
  const paths = tsConfig.compilerOptions?.paths ?? {};
  register({ baseUrl, paths });
} catch {
  // ignore
}

import { prisma } from '../../lib/prisma';
import { getNextAction, type NextAction } from '../../lib/homeEngine/getNextAction';

function unwrap(res: Awaited<ReturnType<typeof getNextAction>>): NextAction | null {
  if (res == null) return null;
  if (typeof res === 'object' && 'action' in res) return (res as { action: NextAction }).action;
  return res as NextAction;
}

const SUBJECTS = [
  { name: 'Mathematics', slug: 'math' },
  { name: 'Science', slug: 'science' },
];
const MATH_CHAPTERS = [
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

let boardId: string;
let classLevelId: string;
const topicIds: string[] = [];
let student1Id: string;
let student2Id: string;
let student3Id: string;
const subjectNames = SUBJECTS.map((s) => s.name);

beforeAll(async () => {
  const board = await prisma.board.upsert({
    where: { slug: 'cbse' },
    create: { name: 'CBSE', slug: 'cbse' },
    update: {},
  });
  boardId = board.id;
  const classLevel = await prisma.classLevel.upsert({
    where: { boardId_grade: { boardId: board.id, grade: 10 } },
    create: { grade: 10, slug: 'grade-10', boardId: board.id },
    update: {},
  });
  classLevelId = classLevel.id;

  for (const subj of SUBJECTS) {
    const subject = await prisma.subjectDef.upsert({
      where: { classId_slug: { classId: classLevel.id, slug: subj.slug } },
      create: { name: subj.name, slug: subj.slug, classId: classLevel.id },
      update: {},
    });
    const chapters = subj.slug === 'science' ? SCIENCE_CHAPTERS : MATH_CHAPTERS;
    for (const ch of chapters) {
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
      for (const tp of TOPICS_PER_CHAPTER) {
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

        await prisma.topicNote.upsert({
          where: {
            topicId_language_version: { topicId: topic.id, language: 'en', version: 1 },
          },
          create: {
            topicId: topic.id,
            language: 'en',
            title: `${subj.name} - ${ch.name} - ${tp.name}`,
            contentJson: { summary: 'Summary', keyPoints: ['P1', 'P2'] },
            source: 'seed',
            status: 'approved',
            lifecycle: 'active',
          },
          update: { status: 'approved', lifecycle: 'active' },
        });

        const count = await prisma.question.count({ where: { topicId: topic.id } });
        if (count < 3) {
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
                prompt: `Q ${tp.name} (${diff})`,
                choices: ['A', 'B', 'C', 'D'],
                correctAnswer: 'A',
                source: 'seed',
              },
            });
          }
        }

        const testExists = await prisma.generatedTest.findFirst({
          where: { topicId: topic.id, lifecycle: 'active' },
        });
        if (!testExists) {
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
                question: `Q${q} for ${tp.name}`,
                options: ['A', 'B', 'C', 'D'],
                answer: { final_answer: 'A' },
                explanation: 'Exp',
              },
            });
          }
        }
      }
    }
  }

  const s1 = await prisma.user.upsert({
    where: { email: 'fresh@scenario.test' },
    create: {
      name: 'Fresh Student',
      email: 'fresh@scenario.test',
      language: 'en',
      board: 'cbse',
      grade: '10',
      subjects: subjectNames,
      role: 'user',
    },
    update: { board: 'cbse', grade: '10', subjects: subjectNames },
  });
  student1Id = s1.id;

  const s2 = await prisma.user.upsert({
    where: { email: 'midsession@scenario.test' },
    create: {
      name: 'Mid-Session Student',
      email: 'midsession@scenario.test',
      language: 'en',
      board: 'cbse',
      grade: '10',
      subjects: subjectNames,
      role: 'user',
    },
    update: { board: 'cbse', grade: '10', subjects: subjectNames },
  });
  student2Id = s2.id;

  const s3 = await prisma.user.upsert({
    where: { email: 'weak@scenario.test' },
    create: {
      name: 'Weak Topic Student',
      email: 'weak@scenario.test',
      language: 'en',
      board: 'cbse',
      grade: '10',
      subjects: subjectNames,
      role: 'user',
    },
    update: { board: 'cbse', grade: '10', subjects: subjectNames },
  });
  student3Id = s3.id;
}, 120_000);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Scenarios with full curriculum (2 subjects, 2 chapters, 2 topics each)', () => {
  it('Scenario A — Fresh student: P5 next_new_topic, actionType notes, first topic', async () => {
    await prisma.structuredSession.deleteMany({ where: { studentId: student1Id } });
    await prisma.learningSession.deleteMany({ where: { studentId: student1Id } });
    await prisma.studentTopicMastery.deleteMany({ where: { studentId: student1Id } });
    await prisma.attentionFlag.deleteMany({ where: { studentId: student1Id } });

    const action = unwrap(await getNextAction(student1Id));
    expect(action).not.toBeNull();
    expect(action!.ruleId).toBe('next_new_topic');
    expect(action!.actionType).toBe('notes');
    expect(action!.topicId).toBeTruthy();
    expect(topicIds).toContain(action!.topicId!);
  });

  it('Scenario B — Mid-session student: P1 resume_session with resumePhase PRACTICE', async () => {
    await prisma.structuredSession.deleteMany({ where: { studentId: student2Id } });
    const firstTopicId = topicIds[0];
    await prisma.structuredSession.create({
      data: {
        studentId: student2Id,
        topicId: firstTopicId,
        state: 'PRACTICE',
        startedAt: new Date(),
      },
    });

    const action = unwrap(await getNextAction(student2Id));
    expect(action).not.toBeNull();
    expect(action!.ruleId).toBe('resume_session');
    expect(action!.resumePhase).toBe('PRACTICE');
    expect(action!.topicId).toBe(firstTopicId);
  });

  it('Scenario C — Weak topic student: P2 weak_topic_urgent', async () => {
    await prisma.structuredSession.deleteMany({ where: { studentId: student3Id } });
    await prisma.learningSession.deleteMany({ where: { studentId: student3Id } });
    await prisma.homeworkAssignment.deleteMany({ where: { studentId: student3Id } });
    await prisma.attentionFlag.deleteMany({ where: { studentId: student3Id } });
    await prisma.studentTopicMastery.deleteMany({ where: { studentId: student3Id } });
    await prisma.studentTopicProgress.deleteMany({ where: { studentId: student3Id } });
    const weakTopicId = topicIds[1];
    await prisma.studentTopicMastery.upsert({
      where: {
        studentId_topicId: { studentId: student3Id, topicId: weakTopicId },
      },
      create: {
        studentId: student3Id,
        topicId: weakTopicId,
        subject: 'Mathematics',
        chapter: 'Number Systems',
        masteryLevel: 'beginner',
        accuracy: 0.35,
      },
      update: { accuracy: 0.35 },
    });
    // Engine P2 reads studentTopicProgress (not studentTopicMastery).
    await prisma.studentTopicProgress.upsert({
      where: { studentId_topicId: { studentId: student3Id, topicId: weakTopicId } },
      create: {
        studentId: student3Id,
        topicId: weakTopicId,
        mastery: 0.35,
        practiceCount: 6,
        lastStudiedAt: new Date(),
      },
      update: { mastery: 0.35, practiceCount: 6 },
    });

    const action = unwrap(await getNextAction(student3Id));
    expect(action).not.toBeNull();
    expect(action!.ruleId).toBe('weak_topic_urgent');
    expect(action!.actionType).toBe('practice');
  });
});
