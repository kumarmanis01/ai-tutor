/**
 * scripts/chaos-progress-simulation.cjs
 *
 * Simulate 100 randomized practice submissions for a test student and
 * validate the deterministic next-action engine does not oscillate or
 * leak composite keys or unresolved flags. Modeled after
 * scripts/test-mvp-flow.cjs and intended for local use against a
 * running Next.js server and the local database.
 *
 * Requirements:
 *   - Running server at BASE_URL (default http://localhost:3000)
 *   - NEXTAUTH_SECRET set (for forging session cookie)
 *   - DATABASE_URL pointing at same DB the server uses
 *
 * Usage:
 *   node scripts/chaos-progress-simulation.cjs
 *
 * Exit codes: 0 = success, 1 = any failure
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Load .env.local if present (same logic as test-mvp-flow)
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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
    console.log(`[env] loaded ${p}`);
    break;
  }
}
loadEnv();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = (process.env.BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const COOKIE_NAME = BASE_URL.startsWith('https') ? '__Secure-next-auth.session-token' : 'next-auth.session-token';

// Helpers: assertions & counters
let failures = [];
function fail(msg) {
  failures.push(msg);
  console.error('✗', msg);
}

async function getEncoder() {
  const mod = await import('next-auth/jwt');
  return mod.encode;
}

async function createSessionCookie(userId, email, name = 'Chaos User') {
  if (!NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET is not set');
  const encode = await getEncoder();
  const now = Math.floor(Date.now() / 1000);
  const token = await encode({
    token: { sub: userId, id: userId, email, name, role: 'user', iat: now, exp: now + 3600, jti: `chaos-${userId}-${now}` },
    secret: NEXTAUTH_SECRET,
    maxAge: 3600,
  });
  return `${COOKIE_NAME}=${token}`;
}

async function apiGet(p, cookie) {
  const url = `${BASE_URL}${p}`;
  const res = await fetch(url, { method: 'GET', headers: { Cookie: cookie, 'Content-Type': 'application/json' } });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function apiPost(p, cookie, payload) {
  const url = `${BASE_URL}${p}`;
  const res = await fetch(url, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function ensureUser(email, board, grade) {
  return prisma.user.upsert({
    where: { email },
    update: { board, grade: String(grade), subjects: [] },
    create: { email, language: 'en', board, grade: String(grade), subjects: [] },
  });
}

async function clearUserData(studentId) {
  await prisma.attentionFlag.deleteMany({ where: { studentId } });
  await prisma.studentTopicMastery.deleteMany({ where: { studentId } });
  await prisma.learningSession.deleteMany({ where: { studentId } });
}

// Curriculum helper copied from test-mvp-flow to match engine filters exactly
async function getOrderedTopicsForStudent(studentId) {
  const user = await prisma.user.findUnique({ where: { id: studentId }, select: { board: true, grade: true, subjects: true } });
  const grade = user?.grade ? parseInt(String(user.grade), 10) : NaN;
  if (!user?.board || isNaN(grade)) return [];
  const subjectNameFilter = Array.isArray(user.subjects) && user.subjects.length > 0 ? { name: { in: user.subjects } } : {};
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
            board: { lifecycle: 'active', slug: { equals: user.board, mode: 'insensitive' } },
          },
        },
      },
    },
    orderBy: [{ chapter: { order: 'asc' } }, { order: 'asc' }],
    include: { chapter: { include: { subject: { include: { class: { include: { board: true } } } } } } },
  });
}

// Create or upsert a minimal GeneratedTest + Question for a topic and return { genTestId, questionId }
async function ensureGeneratedTestAndQuestion(topic, subject, chapterName) {
  const topicId = topic.id;
  const genTest = await prisma.generatedTest.upsert({
    where: { topicId_difficulty_language_version: { topicId, difficulty: 'easy', language: 'en', version: 9999 } },
    create: { topicId, title: '[CHAOS] Sim Test', difficulty: 'easy', language: 'en', version: 9999, status: 'approved' },
    update: { title: '[CHAOS] Sim Test', status: 'approved' },
  });

  // Create a deterministic question for this test (idempotent by prompt text)
  const prompt = `[CHAOS] ${topic.name} sample question`;
  let question = await prisma.question.findFirst({ where: { prompt } });
  if (!question) {
    question = await prisma.question.create({ data: { subject, chapter: chapterName, type: 'mcq', prompt, choices: JSON.stringify([{ key: 'A', label: 'True' }, { key: 'B', label: 'False' }]), correctAnswer: 'a', difficulty: 'easy' } });
  }

  return { genTestId: genTest.id, questionId: question.id };
}

// Create a new TestResult + AttemptQuestion for the given genTest/question and return attemptId
async function seedAttemptForQuestion(genTestId, questionId, studentId) {
  const attempt = await prisma.testResult.create({ data: { testId: genTestId, studentId, startedAt: new Date() } });
  await prisma.attemptQuestion.create({ data: { testResultId: attempt.id, questionId, order: 1 } });
  return attempt.id;
}

async function simulateRandomPracticeLoop() {
  console.log('Chaos simulation starting — connecting to server and DB');

  // server reachable check
  try {
    const ping = await fetch(`${BASE_URL}/api/health`).catch(() => null) || await fetch(`${BASE_URL}/`).catch(() => null);
    if (!ping) throw new Error('no response');
    console.log(`[ok] Server reachable at ${BASE_URL}`);
  } catch (err) {
    fail(`Server not reachable at ${BASE_URL} — start server before running`);
    return 1;
  }

  if (!NEXTAUTH_SECRET) {
    fail('NEXTAUTH_SECRET not set — cannot forge session cookies');
    return 1;
  }

  // bootstrap topic
  const seedTopic = await prisma.topicDef.findFirst({ where: { lifecycle: 'active', chapter: { lifecycle: 'active', subject: { lifecycle: 'active', class: { lifecycle: 'active', board: { lifecycle: 'active' } } } } }, orderBy: [{ chapter: { order: 'asc' } }, { order: 'asc' }], include: { chapter: { include: { subject: { include: { class: { include: { board: true } } } } } } } );
  if (!seedTopic) {
    fail('No active TopicDef found. Run seed scripts first.');
    return 1;
  }

  const boardSlug = seedTopic.chapter.subject.class.board.slug;
  const grade = seedTopic.chapter.subject.class.grade;

  const user = await ensureUser('test-chaos@mvp-test.local', boardSlug, grade);
  const userId = user.id;
  await clearUserData(userId);

  const cookie = await createSessionCookie(userId, user.email, 'Chaos Runner');

  const allTopics = await getOrderedTopicsForStudent(userId);
  if (!allTopics || allTopics.length === 0) {
    fail('No topics returned for bootstrap user — aborting');
    return 1;
  }

  console.log(`Found ${allTopics.length} topics; beginning 100 randomized practice iterations`);

  const seenDecisions = [];
  const decisionWindow = 12; // sliding window to detect oscillation
  const completedTopicSet = new Set();

  for (let iter = 0; iter < 100; iter++) {
    try {
      // pick a random topic from the ordered list
      const topic = allTopics[Math.floor(Math.random() * allTopics.length)];
      const topicId = topic.id;
      const subject = topic.chapter.subject.name;
      const chapterName = topic.chapter.name;

      // 1) GET next-action — record current engine decision
      const before = await apiGet('/api/home/next-action', cookie);
      if (before.status !== 200) throw new Error(`next-action HTTP ${before.status}`);
      const actionBefore = before.body?.action || {};
      const keyBefore = `${actionBefore.ruleId || 'nil'}::${actionBefore.topicId || 'nil'}`;
      seenDecisions.push(keyBefore);
      if (seenDecisions.length > decisionWindow) seenDecisions.shift();

      // detect simple oscillation: same (rule,topic) repeating often
      const last = seenDecisions.slice(-6);
      if (last.length === 6 && last.every((v) => v === last[0])) {
        fail(`Oscillation detected at iter ${iter}: repeated decision ${last[0]}`);
        break;
      }

      // 2) POST complete-action for the chosen topic (simulate lesson complete)
      const c = await apiPost('/api/home/complete-action', cookie, { topicId, subject, chapter: chapterName });
      if (c.status !== 200) throw new Error(`complete-action HTTP ${c.status}`);
      const nextAction = c.body?.nextAction || {};

      // 3) Ensure there is a GeneratedTest + Question and seed a TestResult to submit
      const { genTestId, questionId } = await ensureGeneratedTestAndQuestion(topic, subject, chapterName);
      const attemptId = await seedAttemptForQuestion(genTestId, questionId, userId);

      // 4) Randomly decide correctness (binary): 70% chance correct to bias progress
      const correct = Math.random() < 0.7;
      const answers = [{ questionId, answer: correct ? 'A' : 'B', timeSpent: Math.floor(Math.random() * 30) + 5 }];
      const s = await apiPost('/api/tests/submit', cookie, { attemptId, answers });
      if (s.status !== 200) throw new Error(`submit HTTP ${s.status}`);
      const scorePercent = s.body?.scorePercent;

      // 5) After submit, call next-action again and record decision
      const after = await apiGet('/api/home/next-action', cookie);
      if (after.status !== 200) throw new Error(`next-action (post-submit) HTTP ${after.status}`);
      const actionAfter = after.body?.action || {};
      const keyAfter = `${actionAfter.ruleId || 'nil'}::${actionAfter.topicId || 'nil'}`;
      seenDecisions.push(keyAfter);
      if (seenDecisions.length > decisionWindow) seenDecisions.shift();

      // 6) Basic integrity checks on DB state for this user+topic
      const stm = await prisma.studentTopicMastery.findFirst({ where: { studentId: userId, topicId } });
      if (!stm) {
        fail(`Missing StudentTopicMastery after submit for topic ${topicId} (iter ${iter})`);
        break;
      }
      // No composite keys
      if (stm.topicId.includes('::')) {
        fail(`Composite topicId leaked into STM: ${stm.topicId}`);
        break;
      }
      // If score implies mastery, ensure any AttentionFlag is resolved
      if ((stm.accuracy ?? 0) >= 0.6) {
        const flag = await prisma.attentionFlag.findFirst({ where: { studentId: userId, topicId, resolved: false } });
        if (flag) {
          fail(`Unresolved AttentionFlag despite accuracy >= 0.6 for topic ${topicId}`);
          break;
        }
      }

      // Track topics that reached accuracy >= 0.6
      if ((stm.accuracy ?? 0) >= 0.6) completedTopicSet.add(topicId);

      // Log progress every 10 iterations
      if ((iter + 1) % 10 === 0) {
        console.log(`  iter ${iter + 1}: score=${scorePercent} ruleBefore=${actionBefore.ruleId} ruleAfter=${actionAfter.ruleId} topic=${topic.name}`);
      }

    } catch (err) {
      fail(`Iteration ${iter} error: ${err?.message || String(err)}`);
      break;
    }
  }

  // Final reporting
  console.log('\nChaos simulation complete — summarizing results');
  const finalAction = await apiGet('/api/home/next-action', cookie);
  console.log('Final engine response:', finalAction.status === 200 ? finalAction.body?.action : `HTTP ${finalAction.status}`);

  // Log per-topic accuracies for topics touched
  const mastered = [];
  for (const tid of completedTopicSet) {
    const stm = await prisma.studentTopicMastery.findFirst({ where: { studentId: userId, topicId: tid } });
    mastered.push({ topicId: tid, accuracy: stm?.accuracy ?? null });
  }
  console.log('Mastered topics count:', mastered.length);

  // Clean up: remove generated tests and questions created by chaos (best-effort)
  try {
    await prisma.generatedTest.deleteMany({ where: { title: '[CHAOS] Sim Test' } });
    await prisma.question.deleteMany({ where: { prompt: { contains: '[CHAOS]' } } });
  } catch (e) {
    console.warn('Cleanup warning:', e.message);
  }

  if (failures.length > 0) {
    console.error('\nFailures:');
    failures.forEach((f) => console.error(' -', f));
    return 1;
  }

  console.log('\nAll checks passed.');
  return 0;
}

// Run
simulateRandomPracticeLoop().then((code) => {
  process.exit(code);
}).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
