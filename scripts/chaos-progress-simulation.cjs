require('./bootstrap-env.cjs');
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
const { prisma } = require('../lib/prisma');


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

async function ensureUser(email, board, grade) {
  return prisma.user.upsert({
    where: { email },
    update: { board, grade: String(grade), subjects: [] },
    create: { email, language: 'en', board, grade: String(grade), subjects: [] },
  });
}

async function clearUserData(studentId) {
  await prisma.attentionFlag.deleteMany({ where: { studentId } }).catch(() => {});
  await prisma.studentTopicMastery.deleteMany({ where: { studentId } }).catch(() => {});
  await prisma.learningSession.deleteMany({ where: { studentId } }).catch(() => {});
}

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
        subject: { lifecycle: 'active', ...subjectNameFilter, class: { lifecycle: 'active', grade, board: { lifecycle: 'active', slug: { equals: user.board, mode: 'insensitive' } } } },
      },
    },
    orderBy: [{ chapter: { order: 'asc' } }, { order: 'asc' }],
    include: { chapter: { include: { subject: { include: { class: { include: { board: true } } } } } } },
  });
}

async function ensureGeneratedTestAndQuestion(topic, subject, chapterName) {
  // Upsert a deterministic GeneratedTest for chaos runs
  const genTest = await prisma.generatedTest.upsert({
    where: { topicId_difficulty_language_version: { topicId: topic.id, difficulty: 'easy', language: 'en', version: 9999 } },
    create: { topicId: topic.id, title: '[CHAOS] Sim Test', difficulty: 'easy', language: 'en', version: 9999, status: 'draft' },
    update: { title: '[CHAOS] Sim Test', status: 'draft' },
  });

  // Ensure one Question exists for the generated test
  let q = await prisma.question.findFirst({ where: { prompt: { contains: '[CHAOS]' } } });
  if (!q) {
    q = await prisma.question.create({
      data: {
        subject,
        chapter: chapterName,
        type: 'mcq',
        prompt: '[CHAOS] Sim question: is 1+1=2?',
        choices: JSON.stringify([{ key: 'A', label: '2' }, { key: 'B', label: '3' }]),
        correctAnswer: 'a',
        difficulty: 'easy',
      },
    });
  }

  return { genTestId: genTest.id, questionId: q.id };
}

async function seedAttemptForQuestion(genTestId, questionId, userId) {
  const attempt = await prisma.testResult.create({ data: { testId: genTestId, studentId: userId, startedAt: new Date() } });
  await prisma.attemptQuestion.create({ data: { testResultId: attempt.id, questionId, order: 1 } });
  return attempt.id;
}

async function simulateRandomPracticeLoop() {
  console.log('Chaos simulation starting -- connecting to server and DB');

  // CLI mode handling
  const rawMode = (process.argv.find((a) => a.startsWith('--mode=')) || '').split('=')[1] || 'random';
  const MODE = rawMode;
  console.log('Mode:', MODE);

  // server reachable check
  try {
    const ping = await fetch(`${BASE_URL}/api/health`).catch(() => null) || await fetch(`${BASE_URL}/`).catch(() => null);
    if (!ping) throw new Error('no response');
    console.log(`[ok] Server reachable at ${BASE_URL}`);
  } catch (err) {
    fail(`Server not reachable at ${BASE_URL} -- start server before running`);
    return 1;
  }

  if (!NEXTAUTH_SECRET) {
    fail('NEXTAUTH_SECRET not set -- cannot forge session cookies');
    return 1;
  }

  // helper: poll for mastery update
  async function waitForMasteryUpdate(studentId, topicId, prevUpdatedAt) {
    const start = Date.now();
    const timeoutMs = 5000;
    while (Date.now() - start < timeoutMs) {
      const stm = await prisma.studentTopicMastery.findFirst({ where: { studentId, topicId }, select: { updatedAt: true, accuracy: true, masteryLevel: true } });
      if (stm) {
        if (!prevUpdatedAt) return stm;
        const prev = prevUpdatedAt instanceof Date ? prevUpdatedAt : new Date(prevUpdatedAt);
        const now = new Date(stm.updatedAt);
        if (now > prev) return stm;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('mastery update timeout');
  }

  // bootstrap topic
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
    orderBy: [
      { chapter: { order: 'asc' } },
      { order: 'asc' },
    ],
    include: {
      chapter: {
        include: {
          subject: {
            include: {
              class: {
                include: { board: true },
              },
            },
          },
        },
      },
    },
  });
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
    fail('No topics returned for bootstrap user -- aborting');
    return 1;
  }

  console.log(`Found ${allTopics.length} topics; beginning 100 randomized practice iterations`);

  const seenRecords = []; // { key: 'rule::topic', accuracy }
  const decisionWindow = 20; // sliding window
  // Oscillation detection state: tracks the most recent consecutive (topic,rule)
  // sequence and whether mastery updated during that sequence.
  const oscillationState = { topicId: null, ruleId: null, count: 0, updatedSeen: false };
  const completedTopicSet = new Set();

  for (let iter = 0; iter < 100; iter++) {
    try {
      // pick a random topic from the ordered list
      const topic = allTopics[Math.floor(Math.random() * allTopics.length)];
      const topicId = topic.id;
      const subject = topic.chapter.subject.name;
      const chapterName = topic.chapter.name;

      // 1) GET next-action -- record current engine decision
      const before = await apiGet('/api/home/next-action', cookie);
      if (before.status !== 200) throw new Error(`next-action HTTP ${before.status}`);
      const actionBefore = before.body?.action || {};

      // 2) POST complete-action for the chosen topic (simulate lesson complete)
      const c = await apiPost('/api/home/complete-action', cookie, { topicId, subject, chapter: chapterName });
      if (c.status !== 200) throw new Error(`complete-action HTTP ${c.status}`);

      // 3) Ensure there is a GeneratedTest + Question and seed a TestResult to submit
      const { genTestId, questionId } = await ensureGeneratedTestAndQuestion(topic, subject, chapterName);
      const attemptId = await seedAttemptForQuestion(genTestId, questionId, userId);

      // capture previous STM state (for update detection)
      const prevStm = await prisma.studentTopicMastery.findFirst({ where: { studentId: userId, topicId }, select: { updatedAt: true, accuracy: true, masteryLevel: true } });

      // 4) Decide correctness according to mode
      let correct;
      if (MODE === 'all-correct') correct = true;
      else if (MODE === 'all-wrong') correct = false;
      else if (MODE === 'mixed-70') correct = Math.random() < 0.7;
      else correct = Math.random() < 0.7; // default bias

      const answers = [{ questionId, answer: correct ? 'A' : 'B', timeSpent: Math.floor(Math.random() * 30) + 5 }];

      // 5) POST submit and ensure server accepted
      const s = await apiPost('/api/tests/submit', cookie, { attemptId, answers });
      if (s.status !== 200) throw new Error(`submit HTTP ${s.status}`);

      // 6) wait for mastery update (poll STM.updatedAt)
      let stm;
      try {
        stm = await waitForMasteryUpdate(userId, topicId, prevStm?.updatedAt);
      } catch (err) {
        throw new Error(`mastery wait failed for topic ${topicId}: ${err?.message || err}`);
      }

      // 7) After submit and update, call next-action again and record decision
      const after = await apiGet('/api/home/next-action', cookie);
      if (after.status !== 200) throw new Error(`next-action (post-submit) HTTP ${after.status}`);
      const actionAfter = after.body?.action || {};
      const keyAfter = `${actionAfter.ruleId || 'nil'}::${actionAfter.topicId || 'nil'}`;

      // record seen record with accuracy and timestamps for oscillation detection
      const record = {
        key: keyAfter,
        accuracy: stm?.accuracy ?? 0,
        topicId,
        ruleId: actionAfter.ruleId || null,
        updatedAt: stm?.updatedAt ?? null,
        prevUpdatedAt: prevStm?.updatedAt ?? null,
      };
      seenRecords.push(record);
      if (seenRecords.length > decisionWindow) seenRecords.shift();

      // Fetch attention flag state for logs
      const flag = await prisma.attentionFlag.findFirst({ where: { studentId: userId, topicId } });

      // Logging after each iteration
      console.log(`iter ${iter}: topic=${topicId} rule=${record.ruleId || 'nil'} accuracy=${record.accuracy ?? null} mastery=${stm?.masteryLevel ?? null} attentionFlag=${flag ? (flag.resolved ? 'resolved' : 'open') : 'none'}`);

      // Refined oscillation detection (consecutive same topic+rule only)
      if (oscillationState.topicId === record.topicId && oscillationState.ruleId === record.ruleId) {
        // same topic+rule as previous decision in the sequence
        if ((record.accuracy ?? 0) < 0.6) {
          // reset counter when accuracy falls below threshold
          oscillationState.count = 0;
          oscillationState.updatedSeen = false;
        } else {
          oscillationState.count += 1;
          // mark that STM updated during this sequence if updatedAt advanced
          if (record.prevUpdatedAt && record.updatedAt) {
            try {
              if (new Date(record.updatedAt) > new Date(record.prevUpdatedAt)) oscillationState.updatedSeen = true;
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      } else {
        // topic or rule changed -- start a new consecutive sequence
        oscillationState.topicId = record.topicId;
        oscillationState.ruleId = record.ruleId;
        oscillationState.count = (record.accuracy ?? 0) >= 0.6 ? 1 : 0;
        oscillationState.updatedSeen = !!(record.prevUpdatedAt && record.updatedAt && (() => {
          try { return new Date(record.updatedAt) > new Date(record.prevUpdatedAt); } catch (e) { return false; }
        })());
      }

      // Only flag oscillation when same topicId & same ruleId repeated for required count,
      // accuracy is ≥ 0.6 for those repeats, and the STM record showed an updatedAt change.
      if (oscillationState.count >= 5 && oscillationState.updatedSeen) {
        fail(`Oscillation detected at iter ${iter}: repeated decision ${record.ruleId || 'nil'}::${record.topicId}`);
        break;
      }

      // Basic integrity checks on DB state for this user+topic
      if (!stm) {
        fail(`Missing StudentTopicMastery after submit for topic ${topicId} (iter ${iter})`);
        break;
      }
      // No composite keys
      if (stm.topicId && String(stm.topicId).includes('::')) {
        fail(`Composite topicId leaked into STM: ${stm.topicId}`);
        break;
      }
      // If score implies mastery, ensure any AttentionFlag is resolved
      if ((stm.accuracy ?? 0) >= 0.6) {
        const unresolved = await prisma.attentionFlag.findFirst({ where: { studentId: userId, topicId, resolved: false } });
        if (unresolved) {
          fail(`Unresolved AttentionFlag despite accuracy >= 0.6 for topic ${topicId}`);
          break;
        }
      }

      // Track topics that reached accuracy >= 0.6
      if ((stm.accuracy ?? 0) >= 0.6) completedTopicSet.add(topicId);

    } catch (err) {
      fail(`Iteration ${iter} error: ${err?.message || String(err)}`);
      break;
    }
  }

  // Final reporting
  console.log('\nChaos simulation complete -- summarizing results');
  const finalAction = await apiGet('/api/home/next-action', cookie);
  console.log('Final engine response:', finalAction.status === 200 ? finalAction.body?.action : `HTTP ${finalAction.status}`);

  // Log per-topic accuracies for topics touched
  const mastered = [];
  for (const tid of completedTopicSet) {
    const stm = await prisma.studentTopicMastery.findFirst({ where: { studentId: userId, topicId: tid } });
    mastered.push({ topicId: tid, accuracy: stm?.accuracy ?? null });
  }
  console.log('Mastered topics count:', mastered.length);

  // Clean up: remove generated tests, attempts and questions created by chaos (best-effort)
  try {
    const dryRun = process.argv.includes('--dry-run');

    // find questions and generated tests created by chaos
    const chaosQuestions = await prisma.question.findMany({ where: { prompt: { contains: '[CHAOS]' } }, select: { id: true } });
    const qIds = chaosQuestions.map((q) => q.id);
    const chaosGenTests = await prisma.generatedTest.findMany({ where: { title: '[CHAOS] Sim Test' }, select: { id: true } });
    const genTestIds = chaosGenTests.map((g) => g.id);

    if (qIds.length === 0 && genTestIds.length === 0) {
      console.log('Cleanup: nothing to remove (no [CHAOS] questions or generated tests found)');
    } else {
      console.log(`Cleanup: found ${qIds.length} question(s), ${genTestIds.length} generatedTest(s)`);

      // Helper to safely call a model operation only if present on prisma client
      const safeCount = async (model, fnName, params) => {
        try {
          if (!model || typeof model[fnName] !== 'function') return null;
          return await model[fnName](params);
        } catch (err) {
          console.warn(`Cleanup: ${fnName} failed on model --`, err?.message || err);
          return null;
        }
      };

      if (dryRun) {
        const c1 = await safeCount(prisma.attemptQuestion, 'count', { where: { questionId: { in: qIds } } });
        const c2 = prisma.studentAnswer ? await safeCount(prisma.studentAnswer, 'count', { where: { questionId: { in: qIds } } }) : null;
        const c3 = await safeCount(prisma.testResult, 'count', { where: { testId: { in: genTestIds } } });
        const c4 = await safeCount(prisma.generatedTest, 'count', { where: { id: { in: genTestIds } } });
        const c5 = await safeCount(prisma.question, 'count', { where: { id: { in: qIds } } });

        console.log('Dry-run cleanup counts (would delete):');
        console.log(' - AttemptQuestion:', c1 ?? 0);
        if (c2 !== null) console.log(' - StudentAnswer:', c2 ?? 0);
        console.log(' - TestResult (attempt):', c3 ?? 0);
        console.log(' - GeneratedTest:', c4 ?? 0);
        console.log(' - Question:', c5 ?? 0);
      } else {
        // 1) delete AttemptQuestion rows that reference the chaos questions
        const delAttemptQ = await prisma.attemptQuestion.deleteMany({ where: { questionId: { in: qIds } } });
        console.log('Cleanup: deleted AttemptQuestion rows:', delAttemptQ.count ?? delAttemptQ);

        // 2) delete StudentAnswer rows if that model exists
        if (prisma.studentAnswer) {
          const delStudentAns = await prisma.studentAnswer.deleteMany({ where: { questionId: { in: qIds } } });
          console.log('Cleanup: deleted StudentAnswer rows:', delStudentAns.count ?? delStudentAns);
        } else {
          console.log('Cleanup: no StudentAnswer model found, skipping');
        }

        // 3) delete attempts/testResults created for generated tests
        const delAttempts = await prisma.testResult.deleteMany({ where: { testId: { in: genTestIds } } });
        console.log('Cleanup: deleted TestResult (attempt) rows:', delAttempts.count ?? delAttempts);

        // 4) delete GeneratedTest rows
        const delGen = await prisma.generatedTest.deleteMany({ where: { id: { in: genTestIds } } });
        console.log('Cleanup: deleted GeneratedTest rows:', delGen.count ?? delGen);

        // 5) delete Question rows
        const delQ = await prisma.question.deleteMany({ where: { id: { in: qIds } } });
        console.log('Cleanup: deleted Question rows:', delQ.count ?? delQ);
      }
    }
  } catch (e) {
    // Never let cleanup throw -- log and continue
    console.warn('Cleanup warning (non-fatal):', e?.message || e);
  }

  if (failures.length > 0) {
    console.error('\nFailures:');
    failures.forEach((f) => console.error(' -', f));
    return 1;
  }

  console.log('\nAll checks passed.');
  return 0;
}
// (duplicate cleanup block removed)

// Run
simulateRandomPracticeLoop().then((code) => {
  process.exit(code);
}).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
