/**
 * Scenario tests for the recommendation engine. Uses the scenario seed script
 * to create curriculum and students, then runs A/B/C scenarios.
 *
 * Data is provided by: scripts/seed-scenario-curriculum.ts (run in beforeAll).
 * Part of full integration suite: npm run test:integration:all
 *
 * Run alone: npm run test:integration:scenarios
 */

jest.setTimeout(120_000);

import { execSync } from 'child_process';
import path from 'path';
import { prisma } from '../../lib/prisma';
import { getOrderedTopicsForStudent } from '../../lib/homeEngine/getOrderedTopicsForStudent';
import { getNextAction, type NextAction } from '../../lib/homeEngine/getNextAction';

function unwrap(res: Awaited<ReturnType<typeof getNextAction>>): NextAction | null {
  if (res == null) return null;
  if (typeof res === 'object' && 'action' in res) return (res as { action: NextAction }).action;
  return res as NextAction;
}

const SCENARIO_EMAILS = ['fresh@scenario.test', 'midsession@scenario.test', 'weak@scenario.test'];

let topicIds: string[] = [];
let student1Id: string;
let student2Id: string;
let student3Id: string;

beforeAll(async () => {
  const root = path.resolve(__dirname, '../..');
  execSync('./node_modules/.bin/tsx scripts/seed-scenario-curriculum.ts', {
    stdio: 'pipe',
    cwd: root,
    env: process.env,
  });

  const users = await prisma.user.findMany({
    where: { email: { in: SCENARIO_EMAILS } },
    select: { id: true, email: true },
  });
  const byEmail = new Map(users.map((u) => [u.email!, u.id]));
  const missing = SCENARIO_EMAILS.filter((e) => !byEmail.has(e));
  if (missing.length) {
    throw new Error(`Seed did not create scenario students: ${missing.join(', ')}`);
  }

  student1Id = byEmail.get('fresh@scenario.test')!;
  student2Id = byEmail.get('midsession@scenario.test')!;
  student3Id = byEmail.get('weak@scenario.test')!;

  const ordered = await getOrderedTopicsForStudent(student1Id);
  topicIds = ordered.map((t) => t.id);
  if (topicIds.length === 0) {
    throw new Error('Seed did not create curriculum topics for scenario students.');
  }
});

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
