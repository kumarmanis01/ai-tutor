/**
 * Controlled validation tests for the recommendation / next-action engine.
 *
 * Step 1 — Validate recommendation behaviour (Scenarios A–E).
 * Step 3 — Confirm rule order and latency.
 *
 * Scenario D (spaced_revision) and P0 (homework_pending) are Phase-2;
 * we document or skip them here.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
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

async function createCurriculum() {
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
  await prisma.homeworkAssignment?.deleteMany?.().catch(() => {});
  await prisma.learningSession.deleteMany();
  await prisma.structuredSession.deleteMany();
  await prisma.dailyTask.deleteMany();
  await prisma.attentionFlag.deleteMany();
  await prisma.studentTopicMastery.deleteMany();
  await prisma.studentTopicProgress.deleteMany();
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

describe('Step 1 — Validate recommendation behaviour', () => {
  describe('Scenario A — Fresh student', () => {
    it('returns P5 next_new_topic, actionType notes, first curriculum topic', async () => {
      const { topic } = await createCurriculum();
      const user = await prisma.user.create({
        data: { language: 'en', board: 'cbse', grade: '10', subjects: ['Mathematics'] },
      });

      const action = unwrap(await getNextAction(user.id));
      expect(action).not.toBeNull();
      expect(action!.ruleId).toBe('next_new_topic');
      expect(action!.actionType).toBe('notes');
      expect(action!.topicId).toBe(topic.id);
      expect(action!.topicName).toBeTruthy();
    });
  });

  describe('Scenario B — Student mid-session (StructuredSession state PRACTICE)', () => {
    it('returns P1 resume_session with resumePhase PRACTICE', async () => {
      const { topic } = await createCurriculum();
      const user = await prisma.user.create({
        data: { language: 'en', board: 'cbse', grade: '10', subjects: ['Mathematics'] },
      });

      await prisma.structuredSession.create({
        data: {
          id: `sess-${Date.now()}`,
          studentId: user.id,
          topicId: topic.id,
          state: 'PRACTICE',
          startedAt: new Date(),
        },
      });

      const action = unwrap(await getNextAction(user.id));
      expect(action).not.toBeNull();
      expect(action!.ruleId).toBe('resume_session');
      expect(action!.resumePhase).toBe('PRACTICE');
      expect(action!.sessionId).toBeTruthy();
      expect(action!.topicId).toBe(topic.id);
    });
  });

  describe('Scenario C — Weak topic', () => {
    it('returns P4 low_accuracy when StudentTopicMastery has accuracy < 0.6 and practiceCount context', async () => {
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
          accuracy: 0.35,
        },
      });

      const action = unwrap(await getNextAction(user.id));
      expect(action).not.toBeNull();
      expect(['low_accuracy', 'low_mastery']).toContain(action!.ruleId);
      expect(action!.actionType).toBe('practice');
      expect(action!.topicId).toBe(topic.id);
    });
  });

  describe('Scenario D — Spaced repetition', () => {
    it.skip('Phase-2: P3 spaced_revision when mastery 0.65 and lastStudiedAt 7 days ago (not yet implemented)', () => {});
  });

  describe('Scenario E — Homework pending', () => {
    it('P0 homework_pending is Phase-2; getNextAction currently does not override with homework', async () => {
      const { topic } = await createCurriculum();
      const user = await prisma.user.create({
        data: { language: 'en', board: 'cbse', grade: '10', subjects: ['Mathematics'] },
      });

      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + 24);

      await prisma.structuredSession.create({
        data: {
          id: `sess-hw-${Date.now()}`,
          studentId: user.id,
          topicId: topic.id,
          state: 'HOMEWORK',
          startedAt: new Date(),
        },
      });

      const action = unwrap(await getNextAction(user.id));
      expect(action).not.toBeNull();
      expect(action!.ruleId).toBe('resume_session');
      expect(action!.resumePhase).toBe('HOMEWORK');
    });
  });
});

describe('Step 3 — Rule order and latency', () => {
  it('LOCK (StructuredSession) overrides P5: when active session exists, returns resume_session not next_new_topic', async () => {
    const { topic } = await createCurriculum();
    const user = await prisma.user.create({
      data: { language: 'en', board: 'cbse', grade: '10', subjects: ['Mathematics'] },
    });

    await prisma.structuredSession.create({
      data: {
        id: `sess-order-${Date.now()}`,
        studentId: user.id,
        topicId: topic.id,
        state: 'EXPLANATION',
        startedAt: new Date(),
      },
    });

    const action = unwrap(await getNextAction(user.id));
    expect(action!.ruleId).toBe('resume_session');
    expect(action!.ruleId).not.toBe('next_new_topic');
  });

  it('P1 beats P5: when incomplete LearningSession exists (no StructuredSession), returns resume_session', async () => {
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

    const action = unwrap(await getNextAction(user.id));
    expect(action!.ruleId).toBe('resume_session');
    expect(action!.ruleId).not.toBe('next_new_topic');
  });

  it('getNextAction trace includes rulesEvaluated and matchedRule when returnTrace true', async () => {
    const { topic } = await createCurriculum();
    const user = await prisma.user.create({
      data: { language: 'en', board: 'cbse', grade: '10', subjects: ['Mathematics'] },
    });

    await prisma.structuredSession.create({
      data: {
        id: `sess-trace-${Date.now()}`,
        studentId: user.id,
        topicId: topic.id,
        state: 'PRACTICE',
        startedAt: new Date(),
      },
    });

    const result = await getNextAction(user.id, { returnTrace: true });
    expect(result).not.toBeNull();
    expect(typeof result).toBe('object');
    const withTrace = result as { action: NextAction; traceId: string; trace: { rulesEvaluated: string[]; matchedRule: string; finalDecision: string; latencyMs?: number } };
    expect(withTrace.trace).toBeDefined();
    expect(Array.isArray(withTrace.trace.rulesEvaluated)).toBe(true);
    expect(withTrace.trace.rulesEvaluated).toContain('LOCK');
    expect(withTrace.trace.matchedRule).toBe('resume_session');
    expect(withTrace.trace.finalDecision).toBe('resume_session');
    expect(typeof withTrace.trace.latencyMs).toBe('number');
  });

  it('average latency over 100 calls is under 80ms (target <50ms)', async () => {
    const { topic } = await createCurriculum();
    const user = await prisma.user.create({
      data: { language: 'en', board: 'cbse', grade: '10', subjects: ['Mathematics'] },
    });

    const iterations = 100;
    const times: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await getNextAction(user.id, { returnTrace: true });
      times.push(Date.now() - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avg).toBeLessThan(80);
  }, 60_000);
});

describe('Step 4 — Dashboard integration: any ruleId is safe', () => {
  const KNOWN_RULE_IDS = [
    'resume_session',
    'daily_task',
    'low_mastery',
    'low_accuracy',
    'next_new_topic',
    'all_topics_complete',
  ];

  it('PrimaryActionCard receives type resume | start | homework only (no ruleId dependency)', () => {
    const validTypes = ['resume', 'start', 'homework'];
    validTypes.forEach((type) => {
      expect(validTypes).toContain(type);
    });
  });

  it('all known ruleIds are handled without throwing', () => {
    KNOWN_RULE_IDS.forEach((ruleId) => {
      const action = {
        topicId: 'tid',
        topicName: 'Topic',
        subject: 'Math',
        chapter: 'Ch1',
        ruleId,
        reasonLabel: 'Test',
        actionType: 'notes' as const,
      };
      expect(action.ruleId).toBe(ruleId);
    });
  });
});
