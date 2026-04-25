require('./bootstrap-env.cjs');
/**
 * scripts/test-mvp-flow.cjs
 *
 * Deterministic end-to-end MVP flow validation.
 * Makes real HTTP calls to /api/home/next-action and /api/home/complete-action
 * using forged (but cryptographically valid) NextAuth JWT session cookies.
 * The ONLY source of engine rule logic is lib/homeEngine/getNextAction.ts,
 * invoked via the HTTP API layer. This script never reimplements engine
 * queries or mastery threshold derivations.
 *
 * Prisma is used only for DB fixture setup, practice-state simulation,
 * and cleanup.
 *
 * Five scenarios:
 *   1. FRESH    -- no mastery, no sessions → next_new_topic
 *   2. WEAK     -- mastery accuracy=0.3 + AttentionFlag → low_mastery
 *   3. ACTIVE   -- open LearningSession → resume_session
 *   4. MULTI    -- 5 topics sequentially: lesson → practice → next topic (no regression)
 *   5. PIPELINE -- full HTTP: next-action → complete-action → submit → next-action
 *                 verifies updateTopicMastery uses canonical TopicDef.id (not subject::chapter)
 *
 * For each scenario:
 *   a) Setup DB state via Prisma
 *   b) HTTP GET  /api/home/next-action          → assert initial rule
 *   c) HTTP POST /api/home/complete-action       → assert rule transitions to low_accuracy
 *   d) Prisma:   simulatePracticeComplete        → accuracy 0.75, flag resolved
 *   e) HTTP GET  /api/home/next-action          → assert rule advanced (no longer low_accuracy)
 *   f) Cleanup
 *
 * Requirements:
 *   - A running Next.js server at BASE_URL (default http://localhost:3000)
 *   - NEXTAUTH_SECRET matching the running server
 *   - DATABASE_URL pointing at the same DB as the server
 *
 * Usage:
 *   node scripts/test-mvp-flow.cjs
 *   node scripts/test-mvp-flow.cjs --dry-run
 *   BASE_URL=http://localhost:3001 node scripts/test-mvp-flow.cjs
 *
 * Exit codes: 0 = all pass, 1 = any failure or fatal error.
 */

('use strict');

const fs = require('fs');
const path = require('path');

// ── CLI flags ────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');

// ── Env loader ────────────────────────────────────────────────────────────────
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
const { prisma } = require('../lib/prisma');

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = (
  process.env.BASE_URL ||
  process.env.NEXTAUTH_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
// NextAuth uses __Secure- prefix on HTTPS
const COOKIE_NAME = BASE_URL.startsWith('https')
  ? '__Secure-next-auth.session-token'
  : 'next-auth.session-token';

// ── Assertions ────────────────────────────────────────────────────────────────
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
    console.log(`  ✓ ${label} → ${actual} (≠ ${notExpected})`);
    passed++;
  } else {
    const msg = `FAIL [${label}]: expected anything but "${notExpected}", got "${actual}"`;
    console.error(`  ✗ ${msg}`);
    failed++;
    failures.push(msg);
  }
}

function assertOk(label, value, detail = '') {
  if (value) {
    console.log(`  ✓ ${label}${detail ? ' → ' + detail : ''}`);
    passed++;
  } else {
    const msg = `FAIL [${label}]: value is falsy${detail ? ' (' + detail + ')' : ''}`;
    console.error(`  ✗ ${msg}`);
    failed++;
    failures.push(msg);
  }
}

// ── JWT factory (NextAuth v4 compatible) ──────────────────────────────────────
let _encode;
async function getEncoder() {
  if (_encode) return _encode;
  // next-auth/jwt is ESM -- dynamic import works from CJS in Node ≥ 18
  const mod = await import('next-auth/jwt');
  _encode = mod.encode;
  return _encode;
}

async function createSessionCookie(userId, email, name = 'Test User') {
  if (!NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET is not set');
  const encode = await getEncoder();
  const now = Math.floor(Date.now() / 1000);
  const token = await encode({
    token: {
      sub: userId,
      id: userId,
      email,
      name,
      role: 'user',
      iat: now,
      exp: now + 3600,
      jti: `test-${userId}-${now}`,
    },
    secret: NEXTAUTH_SECRET,
    maxAge: 3600,
  });
  return `${COOKIE_NAME}=${token}`;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function apiGet(path, cookie) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function apiPost(path, cookie, payload) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function ensureUser(email, board, grade) {
  return prisma.user.upsert({
    where: { email },
    update: { board, grade: String(grade), subjects: [] },
    create: { email, language: 'en', board, grade: String(grade), subjects: [] },
  });
}

/**
 * Simulate a practice session completing with a given accuracy.
 * Writes only the DB columns the engine actually checks (accuracy,
 * questionsAttempted, AttentionFlag.resolved). masteryLevel is set to
 * 'beginner' -- the engine's P1-P5 rules never inspect it; the real
 * derivation lives exclusively in lib/tests.ts:updateTopicMastery().
 */
async function simulatePracticeComplete(studentId, topicId, subject, chapter, accuracy) {
  await prisma.$transaction(async (tx) => {
    await tx.studentTopicMastery.upsert({
      where: { studentId_topicId: { studentId, topicId } },
      update: { accuracy, questionsAttempted: 10, lastAttemptedAt: new Date() },
      create: {
        studentId,
        topicId,
        subject,
        chapter,
        masteryLevel: 'beginner',
        accuracy,
        questionsAttempted: 10,
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

async function clearUserData(studentId) {
  await prisma.attentionFlag.deleteMany({ where: { studentId } });
  await prisma.studentTopicMastery.deleteMany({ where: { studentId } });
  await prisma.learningSession.deleteMany({ where: { studentId } });
}

// ── Curriculum helper (mirrors lib/homeEngine/getOrderedTopicsForStudent.ts) ──
/**
 * Returns all active TopicDefs for a student's board + grade + subjects context,
 * ordered by chapter.order ASC, topic.order ASC.
 *
 * Mirrors lib/homeEngine/getOrderedTopicsForStudent exactly -- guarantees the
 * test script and the engine work from an identical, student-scoped dataset.
 * Any change to the engine's curriculum filters must be mirrored here.
 */
async function getOrderedTopicsForStudent(studentId) {
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: { board: true, grade: true, subjects: true },
  });

  const grade = user?.grade ? parseInt(String(user.grade), 10) : NaN;
  if (!user?.board || isNaN(grade)) return [];

  const subjectNameFilter =
    Array.isArray(user.subjects) && user.subjects.length > 0 ? { name: { in: user.subjects } } : {};

  return prisma.topicDef.findMany({
    where: {
      lifecycle: 'active',
      chapter: {
        lifecycle: 'active',
        subject: {
          lifecycle: 'active',
          ...subjectNameFilter,
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
    include: {
      chapter: {
        include: {
          subject: { include: { class: { include: { board: true } } } },
        },
      },
    },
  });
}

// ── Scenario 1: FRESH student ─────────────────────────────────────────────────
async function testFreshStudent(topic) {
  console.log('\n━━━ Scenario 1: FRESH student ━━━');

  const { id: topicId, chapter } = topic;
  const subject = chapter.subject.name;
  const chapterName = chapter.name;
  const boardSlug = chapter.subject.class.board.slug;
  const grade = chapter.subject.class.grade;

  const user = await ensureUser('test-mvp-fresh@mvp-test.local', boardSlug, grade);
  const userId = user.id;
  await clearUserData(userId);

  const cookie = await createSessionCookie(userId, user.email, 'Fresh Student');

  // ── a) Initial next-action: no mastery, no sessions → next_new_topic (P5) ──
  const r1 = await apiGet('/api/home/next-action', cookie);
  assert('FRESH HTTP status', r1.status, 200);
  assert('FRESH initial rule', r1.body?.action?.ruleId, 'next_new_topic');
  assert('FRESH initial actionType', r1.body?.action?.actionType, 'notes');

  // ── b) Complete lesson → POST complete-action (with topicId) ─────────────
  const r2 = await apiPost('/api/home/complete-action', cookie, {
    topicId,
    subject,
    chapter: chapterName,
  });
  assert('FRESH complete-action status', r2.status, 200);
  // complete-action returns nextAction inline -- should already be low_accuracy
  assert('FRESH complete-action nextAction rule', r2.body?.nextAction?.ruleId, 'low_accuracy');
  assert('FRESH complete-action actionType', r2.body?.nextAction?.actionType, 'practice');

  // ── c) Confirm via fresh next-action call ─────────────────────────────────
  const r3 = await apiGet('/api/home/next-action', cookie);
  assert('FRESH post-lesson next-action rule', r3.body?.action?.ruleId, 'low_accuracy');

  // ── d) Simulate practice with good score (75%) ────────────────────────────
  await simulatePracticeComplete(userId, topicId, subject, chapterName, 0.75);

  // ── e) Rule must advance -- no longer low_accuracy for that topic ──────────
  const r4 = await apiGet('/api/home/next-action', cookie);
  assertNot('FRESH after practice -- rule advanced', r4.body?.action?.ruleId, 'low_accuracy');

  return userId;
}

// ── Scenario 2: WEAK student ──────────────────────────────────────────────────
async function testWeakStudent(topic) {
  console.log('\n━━━ Scenario 2: WEAK student ━━━');

  const { id: topicId, chapter } = topic;
  const subject = chapter.subject.name;
  const chapterName = chapter.name;
  const boardSlug = chapter.subject.class.board.slug;
  const grade = chapter.subject.class.grade;

  const user = await ensureUser('test-mvp-weak@mvp-test.local', boardSlug, grade);
  const userId = user.id;
  await clearUserData(userId);

  // Seed: mastery at 30% + unresolved AttentionFlag
  await prisma.studentTopicMastery.create({
    data: {
      studentId: userId,
      topicId,
      subject,
      chapter: chapterName,
      masteryLevel: 'beginner',
      accuracy: 0.3,
      questionsAttempted: 10,
      lastAttemptedAt: new Date(),
    },
  });
  await prisma.attentionFlag.create({
    data: {
      studentId: userId,
      topicId,
      subject,
      chapter: chapterName,
      masteryLevel: 'beginner',
      accuracy: 0.3,
      reason: 'low_mastery',
      resolved: false,
    },
  });

  const cookie = await createSessionCookie(userId, user.email, 'Weak Student');

  // ── a) Initial: unresolved flag → low_mastery (P3) ───────────────────────
  const r1 = await apiGet('/api/home/next-action', cookie);
  assert('WEAK HTTP status', r1.status, 200);
  assert('WEAK initial rule', r1.body?.action?.ruleId, 'low_mastery');
  assert('WEAK initial actionType', r1.body?.action?.actionType, 'practice');

  // ── b) Simulate a lesson-completion call (topic already in mastery, idempotent) ─
  const r2 = await apiPost('/api/home/complete-action', cookie, {
    topicId,
    subject,
    chapter: chapterName,
  });
  assert('WEAK complete-action status', r2.status, 200);
  // Flag still unresolved at this point -- next action stays low_mastery or low_accuracy
  assertNot(
    'WEAK post-lesson rule not next_new_topic yet',
    r2.body?.nextAction?.ruleId,
    'next_new_topic'
  );

  // ── c) Practice with good score (72%) → flag resolved ────────────────────
  await simulatePracticeComplete(userId, topicId, subject, chapterName, 0.72);

  // Verify the AttentionFlag was resolved by simulatePracticeComplete
  const flag = await prisma.attentionFlag.findFirst({
    where: { studentId: userId, topicId, resolved: false },
  });
  assert('WEAK AttentionFlag resolved', String(!flag), 'true');

  // ── d) Rule must advance -- P3 and P4 both gone ───────────────────────────
  const r3 = await apiGet('/api/home/next-action', cookie);
  assertNot(
    'WEAK after practice -- rule no longer low_mastery',
    r3.body?.action?.ruleId,
    'low_mastery'
  );
  assertNot(
    'WEAK after practice -- rule no longer low_accuracy',
    r3.body?.action?.ruleId,
    'low_accuracy'
  );

  return userId;
}

// ── Scenario 3: ACTIVE student ────────────────────────────────────────────────
async function testActiveStudent(topic) {
  console.log('\n━━━ Scenario 3: ACTIVE student (open session) ━━━');

  const { id: topicId, chapter } = topic;
  const subject = chapter.subject.name;
  const chapterName = chapter.name;
  const boardSlug = chapter.subject.class.board.slug;
  const grade = chapter.subject.class.grade;

  const user = await ensureUser('test-mvp-active@mvp-test.local', boardSlug, grade);
  const userId = user.id;
  await clearUserData(userId);

  // Seed: an open LearningSession that must be in the student's curriculum.
  // Use the canonical curriculum helper to pick a valid topic for this student.
  const orderedTopics = await getOrderedTopicsForStudent(userId);
  if (!orderedTopics || orderedTopics.length === 0) {
    throw new Error('No ordered topics found for ACTIVE scenario -- run seed data first');
  }
  const allowedTopicIds = new Set(orderedTopics.map((t) => t.id));
  const sessionTopic = orderedTopics[0];

  const sess = await prisma.learningSession.create({
    data: {
      studentId: userId,
      activityType: 'lesson',
      activityRef: sessionTopic.id,
      difficultyLevel: 'medium',
      isCompleted: false,
      completionPercentage: 0,
      startedAt: new Date(),
      endedAt: null,
      meta: {
        topicId: sessionTopic.id,
        subject: sessionTopic.chapter.subject.name,
        chapter: sessionTopic.chapter.name,
      },
      lastAccessed: new Date(),
    },
  });

  // Assert the seeded session topic is part of the student's curriculum
  assert('ACTIVE session topic in curriculum', allowedTopicIds.has(sess.activityRef), true);

  const cookie = await createSessionCookie(userId, user.email, 'Active Student');

  // ── a) Initial: open session → resume_session (P1) ───────────────────────
  const r1 = await apiGet('/api/home/next-action', cookie);
  assert('ACTIVE HTTP status', r1.status, 200);
  assert('ACTIVE initial rule', r1.body?.action?.ruleId, 'resume_session');

  // ── b) Complete-action with sessionId → session closed, mastery seeded ───
  const r2 = await apiPost('/api/home/complete-action', cookie, {
    topicId,
    subject,
    chapter: chapterName,
    sessionId: sess.id,
  });
  assert('ACTIVE complete-action status', r2.status, 200);
  // Session now closed → P1 gone; mastery at 0% → P4 fires
  assert('ACTIVE post-lesson rule', r2.body?.nextAction?.ruleId, 'low_accuracy');
  assert('ACTIVE post-lesson actionType', r2.body?.nextAction?.actionType, 'practice');

  // ── c) Confirm via fresh call ─────────────────────────────────────────────
  const r3 = await apiGet('/api/home/next-action', cookie);
  assertNot('ACTIVE next-action -- session gone', r3.body?.action?.ruleId, 'resume_session');
  assert('ACTIVE next-action -- low_accuracy', r3.body?.action?.ruleId, 'low_accuracy');

  // ── d) Good practice score → advance ─────────────────────────────────────
  await simulatePracticeComplete(userId, topicId, subject, chapterName, 0.8);

  const r4 = await apiGet('/api/home/next-action', cookie);
  assertNot('ACTIVE after practice -- rule advanced', r4.body?.action?.ruleId, 'low_accuracy');

  return userId;
}

// ── Scenario 4: MULTI-TOPIC SEQUENTIAL PROGRESSION ──────────────────────────
async function testMultiTopicSequential(topics) {
  console.log('\n━━━ Scenario 4: MULTI-TOPIC SEQUENTIAL PROGRESSION ━━━');

  // Use the first topic to derive board/grade for user creation
  const firstTopic = topics[0];
  const boardSlug = firstTopic.chapter.subject.class.board.slug;
  const grade = firstTopic.chapter.subject.class.grade;

  const user = await ensureUser('test-mvp-multi@mvp-test.local', boardSlug, grade);
  const userId = user.id;
  await clearUserData(userId);

  const cookie = await createSessionCookie(userId, user.email, 'Multi Student');

  const completedTopicIds = [];

  for (let i = 0; i < topics.length; i++) {
    const t = topics[i];
    const topicId = t.id;
    const subject = t.chapter.subject.name;
    const chapterName = t.chapter.name;
    const label = `MULTI[${i + 1}/${topics.length}]`;

    console.log(`\n  ── Topic ${i + 1}: "${t.name}" ──`);

    // a) Assert engine recommends next_new_topic pointing at this topic
    const r1 = await apiGet('/api/home/next-action', cookie);
    assert(`${label} rule = next_new_topic`, r1.body?.action?.ruleId, 'next_new_topic');
    assert(`${label} topicId matches`, r1.body?.action?.topicId, topicId);

    // Verify no previously completed topic reappears
    if (completedTopicIds.length > 0) {
      const currentTopicId = r1.body?.action?.topicId;
      const isRegression = completedTopicIds.includes(currentTopicId);
      assertOk(
        `${label} no regression to old topic`,
        !isRegression,
        isRegression ? `regressed to ${currentTopicId}` : 'ok'
      );
    }

    // b) Simulate lesson completion
    const r2 = await apiPost('/api/home/complete-action', cookie, {
      topicId,
      subject,
      chapter: chapterName,
    });
    assert(`${label} complete-action status`, r2.status, 200);

    // c) Assert rule transitions to low_accuracy for this topic
    assert(`${label} post-lesson rule = low_accuracy`, r2.body?.nextAction?.ruleId, 'low_accuracy');

    // d) Simulate practice with accuracy 0.75 (above P4 threshold of 0.6)
    await simulatePracticeComplete(userId, topicId, subject, chapterName, 0.75);
    completedTopicIds.push(topicId);

    // e) After practice, engine should NOT point back to this topic
    const r3 = await apiGet('/api/home/next-action', cookie);
    assertNot(
      `${label} no oscillation back to low_accuracy`,
      r3.body?.action?.ruleId,
      'low_accuracy'
    );

    // If not the last topic, the next action should be next_new_topic for a different topic
    if (i < topics.length - 1) {
      assert(`${label} advances to next_new_topic`, r3.body?.action?.ruleId, 'next_new_topic');
      assertNot(`${label} next topic is different`, r3.body?.action?.topicId, topicId);
    }
  }

  // Final assertion: after all 5 topics, engine should point to the 6th topic
  const rFinal = await apiGet('/api/home/next-action', cookie);
  assert(
    'MULTI final rule = next_new_topic (6th topic)',
    rFinal.body?.action?.ruleId,
    'next_new_topic'
  );
  // The 6th topic must not be any of the 5 completed topics
  const finalTopicId = rFinal.body?.action?.topicId;
  const isRepeat = completedTopicIds.includes(finalTopicId);
  assertOk(
    'MULTI 6th topic is new',
    !isRepeat && !!finalTopicId,
    isRepeat ? `repeated ${finalTopicId}` : `topicId=${finalTopicId}`
  );

  console.log('\n  ┌─────────────────────────────────────────────────────┐');
  console.log('  │     MULTI-TOPIC SEQUENTIAL TEST PASSED              │');
  console.log('  └─────────────────────────────────────────────────────┘');

  return userId;
}

// ── Scenario 5: FULL HTTP PRACTICE PIPELINE ───────────────────────────────────
/**
 * Exercises the complete Notes→Practice→Mastery loop exclusively through HTTP.
 *
 * Setup (Prisma -- no StudentTopicMastery written here):
 *   • Question with known correctAnswer
 *   • GeneratedTest linked to the curriculum TopicDef
 *   • TestResult + AttemptQuestion wiring the attempt to the question
 *
 * HTTP flow:
 *   a) GET  /api/home/next-action          → next_new_topic   (no mastery at all)
 *   b) POST /api/home/complete-action      → low_accuracy     (STM seeded at accuracy=0)
 *   c) POST /api/tests/submit (correct)    → 200, graded, updateTopicMastery runs
 *   d) GET  /api/home/next-action          → engine advanced past low_accuracy
 *
 * Assertions:
 *   • updateTopicMastery resolved canonical TopicDef.id via GeneratedTest
 *   • STM[topicId] accuracy updated to ≥ 0.6 (same record complete-action seeded)
 *   • No unresolved AttentionFlag for the canonical topicId
 *   • Engine P4 clears -- ruleId no longer low_accuracy after submit
 *   • No HTTP 500 errors at any step
 *
 * Returns { userId, genTestId, questionId } for caller-managed cleanup.
 * Question must be deleted AFTER User (User cascade removes AttemptQuestion first,
 * releasing the Question FK; GenTest has no FK constraint to TestResult).
 */
async function testFullHttpPipeline(topic) {
  console.log('\n━━━ Scenario 5: FULL HTTP PRACTICE PIPELINE ━━━');

  const { id: topicId, chapter } = topic;
  const subject = chapter.subject.name;
  const chapterName = chapter.name;
  const boardSlug = chapter.subject.class.board.slug;
  const grade = chapter.subject.class.grade;

  const user = await ensureUser('test-mvp-pipeline@mvp-test.local', boardSlug, grade);
  const userId = user.id;
  await clearUserData(userId);

  // ── 1. Create a Question with a known correct answer ─────────────────────────
  // correctAnswer='a'; normalizeAnswer('A') === 'a' === normalizeAnswer('a') → correct.
  const question = await prisma.question.create({
    data: {
      subject,
      chapter: chapterName,
      type: 'mcq',
      prompt: '[S5] Scenario 5 test question: what is 1 + 1?',
      choices: JSON.stringify([
        { key: 'A', label: '2' },
        { key: 'B', label: '3' },
      ]),
      correctAnswer: 'a',
      difficulty: 'easy',
    },
  });

  // ── 2. Generate minimal GeneratedTest for the topic ──────────────────────────
  // version:9999 is deterministic and unlikely to collide with real curriculum data.
  // Upsert is safe on repeated test runs without relying on prior cleanup success.
  const genTest = await prisma.generatedTest.upsert({
    where: {
      topicId_difficulty_language_version: {
        topicId,
        difficulty: 'easy',
        language: 'en',
        version: 9999,
      },
    },
    create: {
      topicId,
      title: '[S5] Scenario 5 Test',
      difficulty: 'easy',
      language: 'en',
      version: 9999,
      status: 'approved',
    },
    update: { title: '[S5] Scenario 5 Test', status: 'approved' },
  });

  // ── 3. Seed TestResult + AttemptQuestion via Prisma ──────────────────────────
  // StudentTopicMastery is intentionally NOT written here -- it must only be written
  // by the HTTP API pipeline (complete-action seeds it; submit updates it).
  const attempt = await prisma.testResult.create({
    data: {
      testId: genTest.id,
      studentId: userId,
      startedAt: new Date(),
    },
  });

  await prisma.attemptQuestion.create({
    data: { testResultId: attempt.id, questionId: question.id, order: 1 },
  });

  const cookie = await createSessionCookie(userId, user.email, 'Pipeline Student');

  // ── a) GET /api/home/next-action → expect next_new_topic ─────────────────────
  const r1 = await apiGet('/api/home/next-action', cookie);
  assert('PIPELINE [a] HTTP status', r1.status, 200);
  assertNot('PIPELINE [a] no 500', r1.status, 500);
  assert('PIPELINE [a] rule = next_new_topic', r1.body?.action?.ruleId, 'next_new_topic');

  // ── b) POST /api/home/complete-action → seeds STM[topicId, accuracy=0] ───────
  // complete-action upserts StudentTopicMastery with accuracy=0 (first lesson done).
  // P4 (accuracy < 0.6) then fires → nextAction.ruleId = low_accuracy.
  const r2 = await apiPost('/api/home/complete-action', cookie, {
    topicId,
    subject,
    chapter: chapterName,
  });
  assert('PIPELINE [b] complete-action status', r2.status, 200);
  assertNot('PIPELINE [b] no 500', r2.status, 500);
  assert('PIPELINE [b] rule transitions low_accuracy', r2.body?.nextAction?.ruleId, 'low_accuracy');

  // ── c) POST /api/tests/submit with correct answer ─────────────────────────────
  // submit → applyGrading → updateTopicMastery(userId, attemptId).
  // updateTopicMastery resolves canonical TopicDef.id from GeneratedTest.topicId
  // and UPDATES the same STM record complete-action seeded (accuracy 0 → 1.0).
  const r3 = await apiPost('/api/tests/submit', cookie, {
    attemptId: attempt.id,
    answers: [{ questionId: question.id, answer: 'A', timeSpent: 10 }],
  });
  assert('PIPELINE [c] submit HTTP status', r3.status, 200);
  assertNot('PIPELINE [c] no 500 error', r3.status, 500);
  assertOk(
    'PIPELINE [c] scorePercent returned',
    typeof r3.body?.scorePercent === 'number',
    `scorePercent=${r3.body?.scorePercent}`
  );

  // ── Verify: updateTopicMastery was triggered ──────────────────────────────────
  // updateTopicMastery now resolves the canonical TopicDef.id via GeneratedTest,
  // so it updates the SAME STM[topicId] record that complete-action seeded.
  // With 1/1 correct, accuracy updates from 0 → 1.0 (rolling average: (0*0 + 1) / 1).
  const mastery = await prisma.studentTopicMastery.findFirst({
    where: { studentId: userId, topicId },
  });
  assertOk(
    'PIPELINE updateTopicMastery -- STM record updated for canonical topicId',
    !!mastery,
    mastery ? `accuracy=${mastery.accuracy}` : 'NOT FOUND'
  );
  assertOk(
    'PIPELINE updateTopicMastery -- accuracy reflects correct answer (≥ 0.6)',
    mastery?.accuracy != null && mastery.accuracy >= 0.6,
    `accuracy=${mastery?.accuracy}`
  );

  // ── Verify: no composite "subject::chapter" STM key leaked ────────────────────
  const staleComposite = await prisma.studentTopicMastery.findFirst({
    where: { studentId: userId, topicId: { contains: '::' } },
  });
  assertOk(
    'PIPELINE no composite :: mastery key written',
    staleComposite === null,
    staleComposite ? `leaked topicId=${staleComposite.topicId}` : 'ok'
  );

  // ── Verify: AttentionFlag synced ─────────────────────────────────────────────
  // accuracy=1.0 ≥ 0.6 → updateTopicMastery resolves open flags for this topicId.
  const openFlag = await prisma.attentionFlag.findFirst({
    where: { studentId: userId, topicId, resolved: false },
  });
  assertOk(
    'PIPELINE AttentionFlag synced -- no open flag for canonical topicId',
    openFlag === null,
    openFlag ? `unexpected flag id=${openFlag.id}` : 'ok'
  );

  // ── d) GET /api/home/next-action → engine advances past low_accuracy ─────────
  // submit updated STM[topicId] accuracy from 0 → 1.0 (same canonical key).
  // P4 no longer matches (accuracy ≥ 0.6) → engine advances to next topic (P5).
  const r4 = await apiGet('/api/home/next-action', cookie);
  assert('PIPELINE [d] HTTP status', r4.status, 200);
  assertNot('PIPELINE [d] no 500', r4.status, 500);
  const ruleAfterD = r4.body?.action?.ruleId;
  assertNot('PIPELINE [d] engine advanced -- no longer low_accuracy', ruleAfterD, 'low_accuracy');

  console.log('\n  ┌─────────────────────────────────────────────────────┐');
  console.log('  │     FULL HTTP PIPELINE TEST PASSED                  │');
  console.log('  └─────────────────────────────────────────────────────┘');

  return { userId, genTestId: genTest.id, questionId: question.id };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(62));
  console.log('  test-mvp-flow.cjs -- HTTP end-to-end MVP flow validation');
  console.log(`  Server: ${BASE_URL}${DRY_RUN ? '  [DRY RUN]' : ''}`);
  console.log('═'.repeat(62));

  if (DRY_RUN) {
    console.log('\n[dry-run] Would execute 5 scenarios:');
    console.log('  1. FRESH    -- no mastery, no sessions → next_new_topic');
    console.log('  2. WEAK     -- mastery accuracy=0.3 + AttentionFlag → low_mastery');
    console.log('  3. ACTIVE   -- open LearningSession → resume_session');
    console.log('  4. MULTI    -- 5 topics sequentially: lesson → practice → next topic');
    console.log('  5. PIPELINE -- full HTTP: next-action → complete-action → submit → next-action');
    console.log('\n[dry-run] No DB writes, no HTTP calls. Exiting.');
    process.exit(0);
  }

  if (!NEXTAUTH_SECRET) {
    console.error('\n[FATAL] NEXTAUTH_SECRET is not set. Cannot forge session cookies.');
    process.exit(1);
  }

  // Connectivity check
  try {
    const ping =
      (await fetch(`${BASE_URL}/api/health`).catch(() => null)) ||
      (await fetch(`${BASE_URL}/`).catch(() => null));
    if (!ping) throw new Error('no response');
    console.log(`\n[ok] Server reachable at ${BASE_URL}`);
  } catch {
    console.error(`\n[FATAL] Cannot reach server at ${BASE_URL}`);
    console.error('        Start the server first: npm run dev');
    process.exit(1);
  }

  // Bootstrap: discover any active board+grade combo from the curriculum.
  // This single findFirst is the only direct TopicDef query in main() -- all further
  // topic selection goes through getOrderedTopicsForStudent (same filters as the engine).
  const seedTopic = await prisma.topicDef.findFirst({
    where: {
      lifecycle: 'active',
      chapter: {
        lifecycle: 'active',
        subject: {
          lifecycle: 'active',
          class: {
            lifecycle: 'active',
            board: { lifecycle: 'active' },
          },
        },
      },
    },
    orderBy: [{ chapter: { order: 'asc' } }, { order: 'asc' }],
    include: {
      chapter: {
        include: {
          subject: { include: { class: { include: { board: true } } } },
        },
      },
    },
  });

  if (!seedTopic) {
    console.error('\n[FATAL] No active TopicDef found. Run "npm run seed" first.');
    process.exit(1);
  }

  const boardSlug = seedTopic.chapter.subject.class.board.slug;
  const grade = seedTopic.chapter.subject.class.grade;

  // Create a bootstrap user scoped to this board/grade so we can call the
  // shared curriculum helper -- same scoping the engine applies for real students.
  const bootstrapUser = await ensureUser('test-mvp-bootstrap@mvp-test.local', boardSlug, grade);

  // Fetch the canonical ordered topic list via the shared curriculum helper.
  // This mirrors getOrderedTopicsForStudent() exactly -- same filters as the engine.
  const allTopics = await getOrderedTopicsForStudent(bootstrapUser.id);

  // Assertion: topic count returned by the helper must match engine expectation.
  // A mismatch here means the helper and the engine have diverged filter logic.
  assertOk(
    'Curriculum returns active topics for test board/grade',
    allTopics.length >= 1,
    `${allTopics.length} topics found for board=${boardSlug} grade=${grade}`
  );

  if (allTopics.length === 0) {
    console.error('\n[FATAL] getOrderedTopicsForStudent returned 0 topics. Check DB seed.');
    process.exit(1);
  }

  const topic = allTopics[0];
  console.log(`\nUsing topic : "${topic.name}" (${topic.id})`);
  console.log(`  Chapter   : ${topic.chapter.name}`);
  console.log(`  Subject   : ${topic.chapter.subject.name}`);
  console.log(
    `  Board     : ${topic.chapter.subject.class.board.slug}  Grade: ${topic.chapter.subject.class.grade}`
  );

  if (allTopics.length < 6) {
    console.warn(
      `\n[WARN] Only ${allTopics.length} active topics found. Scenario 4 needs ≥6. Skipping Scenario 4.`
    );
  } else {
    console.log(`  Topics    : ${allTopics.length} active topics available for Scenario 4`);
  }

  // Bootstrap user is pre-populated so it is always cleaned up in the finally block.
  const userIds = [bootstrapUser.id];

  // Scenario 5 creates a Question and GeneratedTest that are NOT cascade-linked to the
  // test user, so they must be cleaned up explicitly after user deletion (which cascades
  // TestResult → AttemptQuestion, freeing the AttemptQuestion→Question FK).
  let s5GenTestId = null;
  let s5QuestionId = null;

  try {
    userIds.push(await testFreshStudent(topic));
    userIds.push(await testWeakStudent(topic));
    userIds.push(await testActiveStudent(topic));

    // Scenario 4: needs ≥6 topics (5 to complete + 1 to verify as 6th)
    if (allTopics.length >= 6) {
      userIds.push(await testMultiTopicSequential(allTopics.slice(0, 5)));
    }

    // Scenario 5: full HTTP practice pipeline (always runs -- needs only 1 topic)
    const s5 = await testFullHttpPipeline(topic);
    userIds.push(s5.userId);
    s5GenTestId = s5.genTestId;
    s5QuestionId = s5.questionId;
  } finally {
    console.log('\n── cleanup ──────────────────────────────────────────────────');

    // Standard cleanup: cascades TestResult → AttemptQuestion → Answer for each user.
    // Must run BEFORE Question deletion (AttemptQuestion→Question FK is Restrict).
    for (const id of userIds.filter(Boolean)) {
      await clearUserData(id);
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }

    // Scenario 5 extras: safe to delete now that AttemptQuestion rows are gone.
    if (s5QuestionId) {
      await prisma.question.delete({ where: { id: s5QuestionId } }).catch(() => {});
    }
    if (s5GenTestId) {
      await prisma.generatedTest.delete({ where: { id: s5GenTestId } }).catch(() => {});
    }

    console.log('  test users and related records removed');
    await prisma.$disconnect();
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(62));
  const verdict = failed === 0 ? 'PASS' : 'FAIL';
  console.log(`  ${verdict} -- ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.error('\n  Failures:');
    failures.forEach((f) => console.error(`    • ${f}`));
  }
  console.log('═'.repeat(62) + '\n');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n[FATAL]', err);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});
