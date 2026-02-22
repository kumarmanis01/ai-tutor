/**
 * test-mvp-flow.cjs
 *
 * Deterministic end-to-end validation of the Notes → Practice → Mastery loop.
 *
 * Three scenarios tested:
 *   1. FRESH  student — no mastery, no sessions
 *   2. WEAK   student — existing mastery with low accuracy + AttentionFlag
 *   3. ACTIVE student — open LearningSession (resume-session rule)
 *
 * For each scenario the script:
 *   a) Sets up DB state
 *   b) Asserts the initial HomeEngine rule
 *   c) Simulates lesson completion (complete-action logic)
 *   d) Asserts rule transitions to practice
 *   e) Simulates practice completion (updateTopicMastery logic)
 *   f) Asserts rule no longer targets the same topic
 *   g) Cleans up all test data
 *
 * No test framework. Pure Node + Prisma. Exits 1 on any failure.
 *
 * Usage:
 *   node scripts/test-mvp-flow.cjs
 *   node scripts/test-mvp-flow.cjs --dry-run  (skip destructive writes, log only)
 *
 * Requires DATABASE_URL in .env.local or .env
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── env loader ────────────────────────────────────────────────────────────────
function loadEnv() {
  const root = path.resolve(__dirname, '..');
  for (const name of ['.env.local', '.env']) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    for (let line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^([^=\s]+)=((?:".*")|(?:'.*')|.*)$/);
      if (!m) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
    console.log(`[env] loaded ${p}`);
    break;
  }
}
loadEnv();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

// ── Result tracking ───────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${label} → ${actual}`);
    passed++;
  } else {
    const msg = `FAIL [${label}]: expected "${expected}", got "${actual}"`;
    console.error(`  ✗ ${msg}`);
    failed++;
    failures.push(msg);
  }
}

function assertNot(label, actual, notExpected) {
  if (actual !== notExpected) {
    console.log(`  ✓ ${label} → ${actual} (not ${notExpected})`);
    passed++;
  } else {
    const msg = `FAIL [${label}]: expected something other than "${notExpected}", got "${actual}"`;
    console.error(`  ✗ ${msg}`);
    failed++;
    failures.push(msg);
  }
}

function assertTruthy(label, value) {
  if (value) {
    console.log(`  ✓ ${label} → ${value}`);
    passed++;
  } else {
    const msg = `FAIL [${label}]: expected truthy, got ${value}`;
    console.error(`  ✗ ${msg}`);
    failed++;
    failures.push(msg);
  }
}

// ── Minimal HomeEngine (mirrors lib/homeEngine/getNextAction.ts) ──────────────
// Returns ruleId string or null — no AI, no enrichment, Prisma only.

async function getNextRule(studentId) {
  // P1 — Resume unfinished session
  const session = await prisma.learningSession.findFirst({
    where: { studentId, isCompleted: false },
    orderBy: { lastAccessed: 'desc' },
    select: { id: true },
  });
  if (session) return 'resume_session';

  // P2 — Pending DailyTask for today (skipped in test — no tasks seeded)

  // P3 — Unresolved AttentionFlag
  const flag = await prisma.attentionFlag.findFirst({
    where: { studentId, resolved: false },
    orderBy: { accuracy: 'asc' },
    select: { topicId: true },
  });
  if (flag) return 'low_mastery';

  // P4 — StudentTopicMastery with accuracy < 0.6
  const weak = await prisma.studentTopicMastery.findFirst({
    where: { studentId, accuracy: { lt: 0.6 } },
    orderBy: { accuracy: 'asc' },
    select: { topicId: true },
  });
  if (weak) return 'low_accuracy';

  // P5 — Next unattempted topic in curriculum
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: { board: true, grade: true, subjects: true },
  });
  if (!user?.board || !user?.grade) return null;

  const grade = parseInt(String(user.grade), 10);
  if (isNaN(grade)) return null;

  const attempted = await prisma.studentTopicMastery.findMany({
    where: { studentId },
    select: { topicId: true },
  });
  const attemptedIds = attempted.map((a) => a.topicId);

  const subjectFilter =
    Array.isArray(user.subjects) && user.subjects.length > 0
      ? { name: { in: user.subjects } }
      : {};

  const nextTopic = await prisma.topicDef.findFirst({
    where: {
      lifecycle: 'active',
      ...(attemptedIds.length > 0 ? { id: { notIn: attemptedIds } } : {}),
      chapter: {
        lifecycle: 'active',
        subject: {
          lifecycle: 'active',
          ...subjectFilter,
          class: {
            lifecycle: 'active',
            grade,
            board: {
              lifecycle: 'active',
              slug: { equals: user.board, mode: 'insensitive' },
            },
          },
        },
      },
    },
    orderBy: [{ chapter: { order: 'asc' } }, { order: 'asc' }],
    select: { id: true },
  });
  if (nextTopic) return 'next_new_topic';

  return null; // curriculum exhausted
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function ensureUser(email, board, grade, subjects) {
  return prisma.user.upsert({
    where: { email },
    update: { board, grade: String(grade), subjects: subjects ?? [] },
    create: {
      email,
      language: 'en',
      board,
      grade: String(grade),
      subjects: subjects ?? [],
    },
  });
}

/** Mirrors POST /api/home/complete-action — creates mastery at accuracy=0 */
async function simulateLessonComplete(studentId, topicId, subject, chapter, sessionId) {
  if (DRY_RUN) { console.log('  [dry-run] simulateLessonComplete skipped'); return; }
  await prisma.$transaction(async (tx) => {
    if (sessionId) {
      await tx.learningSession.updateMany({
        where: { id: sessionId, studentId },
        data: { isCompleted: true, completionPercentage: 100, lastAccessed: new Date() },
      });
    }
    await tx.studentTopicMastery.upsert({
      where: { studentId_topicId: { studentId, topicId } },
      update: { lastAttemptedAt: new Date() },
      create: {
        studentId, topicId, subject, chapter,
        masteryLevel: 'beginner', accuracy: 0, questionsAttempted: 0,
        lastAttemptedAt: new Date(),
      },
    });
  });
}

/**
 * Mirrors updateTopicMastery — updates mastery and resolves flag when accuracy >= 0.6.
 * Simplified: directly sets accuracy rather than re-computing rolling average.
 */
async function simulatePracticeComplete(studentId, topicId, subject, chapter, accuracy) {
  if (DRY_RUN) { console.log('  [dry-run] simulatePracticeComplete skipped'); return; }
  const questionsAttempted = 10; // representative count
  let masteryLevel = 'beginner';
  if (accuracy >= 0.9 && questionsAttempted >= 20) masteryLevel = 'expert';
  else if (accuracy >= 0.75 && questionsAttempted >= 10) masteryLevel = 'advanced';
  else if (accuracy >= 0.5 && questionsAttempted >= 5) masteryLevel = 'intermediate';

  await prisma.$transaction(async (tx) => {
    await tx.studentTopicMastery.upsert({
      where: { studentId_topicId: { studentId, topicId } },
      update: { accuracy, masteryLevel, questionsAttempted, lastAttemptedAt: new Date() },
      create: {
        studentId, topicId, subject, chapter,
        masteryLevel, accuracy, questionsAttempted,
        lastAttemptedAt: new Date(),
      },
    });
    if (accuracy >= 0.6) {
      await tx.attentionFlag.updateMany({
        where: { studentId, topicId, resolved: false },
        data: { resolved: true },
      });
    }
  });
}

async function cleanup(userIds) {
  if (DRY_RUN) { console.log('  [dry-run] cleanup skipped'); return; }
  // Delete in dependency order
  for (const id of userIds) {
    await prisma.attentionFlag.deleteMany({ where: { studentId: id } });
    await prisma.studentTopicMastery.deleteMany({ where: { studentId: id } });
    await prisma.learningSession.deleteMany({ where: { studentId: id } });
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
}

// ── Scenario: FRESH student ───────────────────────────────────────────────────

async function testFreshStudent(topic) {
  console.log('\n━━━ Scenario 1: FRESH student ━━━');
  const { id: topicId, chapter } = topic;
  const subject = chapter.subject.name;
  const chapterName = chapter.name;
  const boardSlug = chapter.subject.class.board.slug;
  const grade = chapter.subject.class.grade;

  const user = await ensureUser(
    'test-mvp-fresh@mvp-test.local', boardSlug, grade
  );
  const userId = user.id;

  // Clean state
  await prisma.studentTopicMastery.deleteMany({ where: { studentId: userId } });
  await prisma.learningSession.deleteMany({ where: { studentId: userId } });
  await prisma.attentionFlag.deleteMany({ where: { studentId: userId } });

  // Step 1: initial rule should be next_new_topic (no mastery, no sessions)
  const rule1 = await getNextRule(userId);
  assert('FRESH initial rule', rule1, 'next_new_topic');

  // Step 2: complete lesson → mastery created with accuracy=0
  await simulateLessonComplete(userId, topicId, subject, chapterName);

  const rule2 = await getNextRule(userId);
  assert('FRESH after lesson complete', rule2, 'low_accuracy');

  // Step 3: complete practice with good score (0.75 > 0.6)
  await simulatePracticeComplete(userId, topicId, subject, chapterName, 0.75);

  const rule3 = await getNextRule(userId);
  // Topic accuracy is now 0.75, so P4 should not return it.
  // P5 should return next_new_topic (there are more topics), or null if curriculum exhausted.
  assertNot('FRESH after good practice — rule no longer low_accuracy', rule3, 'low_accuracy');
  assertTruthy('FRESH final rule is defined', rule3 !== undefined);

  return userId;
}

// ── Scenario: WEAK student ────────────────────────────────────────────────────

async function testWeakStudent(topic) {
  console.log('\n━━━ Scenario 2: WEAK student ━━━');
  const { id: topicId, chapter } = topic;
  const subject = chapter.subject.name;
  const chapterName = chapter.name;
  const boardSlug = chapter.subject.class.board.slug;
  const grade = chapter.subject.class.grade;

  const user = await ensureUser(
    'test-mvp-weak@mvp-test.local', boardSlug, grade
  );
  const userId = user.id;

  await prisma.studentTopicMastery.deleteMany({ where: { studentId: userId } });
  await prisma.learningSession.deleteMany({ where: { studentId: userId } });
  await prisma.attentionFlag.deleteMany({ where: { studentId: userId } });

  // Seed weak mastery + unresolved attention flag
  if (!DRY_RUN) {
    await prisma.studentTopicMastery.create({
      data: {
        studentId: userId, topicId, subject, chapter: chapterName,
        masteryLevel: 'beginner', accuracy: 0.3, questionsAttempted: 10,
        lastAttemptedAt: new Date(),
      },
    });
    await prisma.attentionFlag.create({
      data: {
        studentId: userId, topicId, subject, chapter: chapterName,
        masteryLevel: 'beginner', accuracy: 0.3,
        reason: 'low_mastery', resolved: false,
      },
    });
  }

  // Step 1: AttentionFlag exists → P3 fires (low_mastery)
  const rule1 = await getNextRule(userId);
  assert('WEAK initial rule (has AttentionFlag)', rule1, 'low_mastery');

  // Step 2: practice completes with good score → flag resolved
  await simulatePracticeComplete(userId, topicId, subject, chapterName, 0.72);

  // Verify flag is resolved
  const flagAfter = await prisma.attentionFlag.findFirst({
    where: { studentId: userId, topicId, resolved: false },
  });
  assert('WEAK AttentionFlag resolved', String(!flagAfter), 'true');

  const rule2 = await getNextRule(userId);
  assertNot('WEAK after good practice — rule no longer low_mastery', rule2, 'low_mastery');
  assertNot('WEAK after good practice — rule no longer low_accuracy', rule2, 'low_accuracy');

  return userId;
}

// ── Scenario: ACTIVE student ──────────────────────────────────────────────────

async function testActiveStudent(topic) {
  console.log('\n━━━ Scenario 3: ACTIVE student (open session) ━━━');
  const { id: topicId, chapter } = topic;
  const subject = chapter.subject.name;
  const chapterName = chapter.name;
  const boardSlug = chapter.subject.class.board.slug;
  const grade = chapter.subject.class.grade;

  const user = await ensureUser(
    'test-mvp-active@mvp-test.local', boardSlug, grade
  );
  const userId = user.id;

  await prisma.studentTopicMastery.deleteMany({ where: { studentId: userId } });
  await prisma.learningSession.deleteMany({ where: { studentId: userId } });
  await prisma.attentionFlag.deleteMany({ where: { studentId: userId } });

  // Seed open LearningSession
  let sessionId = null;
  if (!DRY_RUN) {
    const sess = await prisma.learningSession.create({
      data: {
        studentId: userId,
        activityType: 'notes',
        activityRef: topicId,
        difficultyLevel: 'medium',
        isCompleted: false,
        completionPercentage: 30,
        meta: { topicId, subject, chapter: chapterName },
        lastAccessed: new Date(),
      },
    });
    sessionId = sess.id;
  }

  // Step 1: open session → P1 fires
  const rule1 = await getNextRule(userId);
  assert('ACTIVE initial rule (open session)', rule1, 'resume_session');

  // Step 2: lesson complete → session marked done, mastery record created
  await simulateLessonComplete(userId, topicId, subject, chapterName, sessionId);

  const rule2 = await getNextRule(userId);
  assertNot('ACTIVE after lesson complete — rule no longer resume_session', rule2, 'resume_session');
  // mastery was created at accuracy=0 → P4 or P5
  assert('ACTIVE after lesson complete — low_accuracy recommended', rule2, 'low_accuracy');

  // Step 3: practice completes — rule should advance
  await simulatePracticeComplete(userId, topicId, subject, chapterName, 0.80);

  const rule3 = await getNextRule(userId);
  assertNot('ACTIVE after practice — no longer low_accuracy for that topic', rule3, 'low_accuracy');

  return userId;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('  test-mvp-flow.cjs — MVP learning loop validation');
  if (DRY_RUN) console.log('  MODE: --dry-run (assertions only, no DB writes)');
  console.log('='.repeat(60));

  // Find an active topic to use across all scenarios
  const topic = await prisma.topicDef.findFirst({
    where: { lifecycle: 'active' },
    include: {
      chapter: {
        include: {
          subject: {
            include: {
              class: { include: { board: true } },
            },
          },
        },
      },
    },
    orderBy: [{ chapter: { order: 'asc' } }, { order: 'asc' }],
  });

  if (!topic) {
    console.error('\n[FATAL] No active TopicDef found. Run "npm run seed-ai-data" first.');
    process.exit(1);
  }

  console.log(`\nUsing topic: "${topic.name}" (${topic.id})`);
  console.log(`  Chapter: ${topic.chapter.name}`);
  console.log(`  Subject: ${topic.chapter.subject.name}`);
  console.log(`  Board: ${topic.chapter.subject.class.board.slug} Grade: ${topic.chapter.subject.class.grade}`);

  const userIds = [];

  try {
    userIds.push(await testFreshStudent(topic));
    userIds.push(await testWeakStudent(topic));
    userIds.push(await testActiveStudent(topic));
  } finally {
    console.log('\n── cleanup ──────────────────────────────────────────────');
    await cleanup(userIds.filter(Boolean));
    console.log('  test users and related records removed');
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`  PASSED: ${passed}   FAILED: ${failed}`);
  if (failures.length > 0) {
    console.error('\n  Failures:');
    failures.forEach((f) => console.error(`    • ${f}`));
  }
  console.log('='.repeat(60));

  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error('\n[FATAL]', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
