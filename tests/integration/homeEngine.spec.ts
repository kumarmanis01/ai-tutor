import { describe, it, expect, beforeEach, afterAll } from 'vitest';

// Ensure TS path aliases (eg. '@/...') are registered at test runtime so imports resolve
import path from 'path';
import { readFileSync } from 'fs';
import { register } from 'tsconfig-paths';

try {
  const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json');
  const tsConfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
  const baseUrl = path.resolve(process.cwd(), tsConfig.compilerOptions?.baseUrl ?? '.');
  const paths = tsConfig.compilerOptions?.paths ?? {};
  register({ baseUrl, paths });
} catch (e) {
  // If registration fails, tests will show import error — let that surface.
}

import { prisma } from '../../lib/prisma';
import { getNextAction } from '../../lib/homeEngine/getNextAction';

/**
 * Integration tests for deterministic Home Engine (getNextAction).
 *
 * - Uses real Prisma client against the configured DATABASE_URL.
 * - Seeds minimal curriculum and student records per test.
 * - Cleans up required tables before each test for determinism.
 */

async function createCurriculum() {
  // Board -> ClassLevel -> SubjectDef -> ChapterDef -> TopicDef
  const board = await prisma.board.create({ data: { name: 'CBSE', slug: 'cbse' } });
  const classLevel = await prisma.classLevel.create({
    data: { grade: 10, slug: 'grade-10', boardId: board.id },
  });
  const subject = await prisma.subjectDef.create({
    data: { name: 'Mathematics', slug: 'math', classId: classLevel.id },
  });
  const chapter = await prisma.chapterDef.create({
    data: { name: 'Number Systems', slug: 'number-sys', order: 1, subjectId: subject.id },
  });
  const topic = await prisma.topicDef.create({
    data: {
      name: 'Integers',
      slug: 'integers',
      order: 1,
      chapterId: chapter.id,
      lifecycle: 'active',
    },
  });

  return { board, classLevel, subject, chapter, topic };
}

beforeEach(async () => {
  // Clean relevant tables in sequence (children -> parents) to avoid FK RESTRICT errors.
  await prisma.learningSession.deleteMany();
  await prisma.dailyTask.deleteMany();
  await prisma.attentionFlag.deleteMany();
  await prisma.studentTopicMastery.deleteMany();
  await prisma.topicDef.deleteMany();
  await prisma.chapterDef.deleteMany();
  await prisma.subjectDef.deleteMany();
  await prisma.classLevel.deleteMany();
  await prisma.board.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('getNextAction deterministic priority rules', () => {
  it('P1: resume_session fires when an incomplete LearningSession exists', async () => {
    const { topic } = await createCurriculum();
    const user = await prisma.user.create({
      data: { language: 'en', board: 'cbse', grade: '10', subjects: ['Mathematics'] },
    });

    await prisma.learningSession.create({
      data: {
        studentId: user.id,
        activityType: 'notes',
        activityRef: topic.id,
        isCompleted: false,
        lastAccessed: new Date(),
        difficultyLevel: 'medium',
      },
    });

    const res = await getNextAction(user.id);
    expect(res).not.toBeNull();
    expect(res!.ruleId).toBe('resume_session');
  });

  it('P2: daily_task fires when a pending DailyTask exists and no session', async () => {
    const { topic } = await createCurriculum();
    const user = await prisma.user.create({
      data: { language: 'en', board: 'cbse', grade: '10', subjects: ['Mathematics'] },
    });

    // Insert a pending DailyTask for today
    await prisma.dailyTask.create({
      data: {
        studentId: user.id,
        status: 'pending',
        taskType: 'learn',
        topicId: topic.id,
        date: new Date(),
        title: "Today's task",
        description: "Daily practice",
      },
    });

    const res = await getNextAction(user.id);
    expect(res).not.toBeNull();
    expect(res!.ruleId).toBe('daily_task');
  });

  it('P3: low_mastery fires when an unresolved AttentionFlag exists', async () => {
    const { topic } = await createCurriculum();
    const user = await prisma.user.create({
      data: { language: 'en', board: 'cbse', grade: '10', subjects: ['Mathematics'] },
    });

    await prisma.attentionFlag.create({
      data: {
        studentId: user.id,
        topicId: topic.id,
        subject: 'Mathematics',
        chapter: 'Number Systems',
        masteryLevel: 'beginner',
        accuracy: 0.35,
        reason: 'low_mastery',
        resolved: false,
      },
    });

    const res = await getNextAction(user.id);
    expect(res).not.toBeNull();
    expect(res!.ruleId).toBe('low_mastery');
  });

  it('P4: low_accuracy fires when StudentTopicMastery accuracy < 0.6', async () => {
    const { topic } = await createCurriculum();
    const user = await prisma.user.create({
      data: { language: 'en', board: 'cbse', grade: '10', subjects: ['Mathematics'] },
    });

    await prisma.studentTopicMastery.create({
      data: {
        studentId: user.id,
        topicId: topic.id,
        subject: 'Mathematics',
        chapter: 'Number Systems',
        masteryLevel: 'beginner',
        accuracy: 0.5,
      },
    });

    const res = await getNextAction(user.id);
    expect(res).not.toBeNull();
    expect(res!.ruleId).toBe('low_accuracy');
  });

  it('P5: next_new_topic fires as fallback when no higher-priority signals exist', async () => {
    const { topic } = await createCurriculum();
    const user = await prisma.user.create({
      data: { language: 'en', board: 'cbse', grade: '10', subjects: ['Mathematics'] },
    });

    const res = await getNextAction(user.id);
    expect(res).not.toBeNull();
    expect(res!.ruleId).toBe('next_new_topic');
    // Ensure the returned topicId matches the seeded topic
    expect(res!.topicId).toBe(topic.id);
  });
});
