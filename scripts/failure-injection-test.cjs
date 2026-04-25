#!/usr/bin/env node
/**
 * scripts/failure-injection-test.cjs
 *
 * Monkey-patch a local Prisma client to inject 200ms latency and 5% random failures.
 * Run GET /api/home/next-action 100 times and validate:
 *  - No crash in this script
 *  - API does not return HTTP 500
 *  - No duplicate StudentTopicMastery rows
 *  - No LearningSession with endedAt IS NULL and isCompleted=true
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 NEXTAUTH_SECRET=... node scripts/failure-injection-test.cjs
 */

'use strict';
const { prisma } = require('../lib/prisma');

const path = require('path');
const { spawnSync } = require('child_process');

const BASE_URL = (
  process.env.BASE_URL ||
  process.env.NEXTAUTH_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const REQUESTS = 100;

let http500 = 0;
let requestErrors = [];
let unhandledRejections = 0;
process.on('unhandledRejection', (r) => {
  unhandledRejections++;
  console.error('unhandledRejection:', r);
});

// Install Prisma middleware to inject delay and occasional errors
prisma.$use(async (params, next) => {
  // artificial latency
  await new Promise((res) => setTimeout(res, 200));
  // random failure 5%
  if (Math.random() < 0.05) {
    throw new Error('Injected DB failure (simulated)');
  }
  return next(params);
});

// fetch helper
let _fetch = global.fetch;
if (!_fetch) {
  try {
    _fetch = require('node-fetch');
  } catch (e) {
    console.error('fetch not available and node-fetch not installed');
    process.exit(1);
  }
}

async function getEncoder() {
  const mod = await import('next-auth/jwt');
  return mod.encode;
}

async function createSessionCookie(userId, email) {
  if (!NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET required');
  const encode = await getEncoder();
  const now = Math.floor(Date.now() / 1000);
  const token = await encode({
    token: {
      sub: userId,
      id: userId,
      email,
      name: 'FailTest',
      role: 'user',
      iat: now,
      exp: now + 3600,
      jti: `fail-${userId}-${now}`,
    },
    secret: NEXTAUTH_SECRET,
    maxAge: 3600,
  });
  const cookieName = BASE_URL.startsWith('https')
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';
  return `${cookieName}=${token}`;
}

async function apiGet(path, cookie) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await _fetch(url, {
      method: 'GET',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    });
    const body = await res.text().catch(() => null);
    if (res.status >= 500) http500++;
    return { status: res.status, body };
  } catch (e) {
    requestErrors.push(e);
    return { status: 0, error: e };
  }
}

async function snapshotCounts() {
  const stmCount = await prisma.studentTopicMastery.count().catch(() => -1);
  const sessionCount = await prisma.learningSession.count().catch(() => -1);
  return { stmCount, sessionCount };
}

async function findDuplicateSTM() {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT "studentId", "topicId", COUNT(*) as cnt FROM "StudentTopicMastery" GROUP BY "studentId","topicId" HAVING COUNT(*) > 1`
    );
    return rows;
  } catch (e) {
    return [{ error: e.message || String(e) }];
  }
}

async function findBadSessions() {
  try {
    const rows = await prisma.learningSession.findMany({
      where: { endedAt: null, isCompleted: true },
      take: 20,
    });
    return rows;
  } catch (e) {
    return [{ error: e.message || String(e) }];
  }
}

(async function main() {
  console.log('Failure injection test starting -- requests=', REQUESTS);
  try {
    // create a test user
    const testEmail = `failure-inject-${Date.now()}@example.com`;
    const user = await prisma.user.upsert({
      where: { email: testEmail },
      update: {},
      create: { email: testEmail, language: 'en' },
    });
    const cookie = await createSessionCookie(user.id, testEmail);

    const before = await snapshotCounts();
    console.log('Before counts:', before);

    for (let i = 0; i < REQUESTS; i++) {
      const r = await apiGet('/api/home/next-action', cookie);
      if (r.status >= 500) {
        console.error('Request', i, 'returned', r.status);
      }
      // small jitter
      await new Promise((res) => setTimeout(res, 20));
    }

    const after = await snapshotCounts();
    console.log('After counts:', after);

    const dup = await findDuplicateSTM();
    const badSessions = await findBadSessions();

    let failed = false;
    if (unhandledRejections > 0) {
      console.error('Unhandled rejections in this process:', unhandledRejections);
      failed = true;
    }
    if (http500 > 0) {
      console.error('HTTP 5xx responses observed:', http500);
      failed = true;
    }
    if (requestErrors.length > 0) {
      console.error('Request errors observed:', requestErrors.length);
      failed = true;
    }
    if (Array.isArray(dup) && dup.length > 0) {
      console.error(
        'Duplicate StudentTopicMastery rows found:',
        JSON.stringify(dup.slice(0, 5), null, 2)
      );
      failed = true;
    }
    if (Array.isArray(badSessions) && badSessions.length > 0) {
      console.error(
        'Bad LearningSession rows found (endedAt=null && isCompleted=true):',
        JSON.stringify(badSessions.slice(0, 5), null, 2)
      );
      failed = true;
    }

    if (failed) {
      console.error('FAILURE INJECTION TEST FAILED');
      process.exit(1);
    }

    console.log('FAILURE INJECTION TEST PASSED');
    process.exit(0);
  } catch (e) {
    console.error('Fatal error:', e && e.stack ? e.stack : e);
    process.exit(1);
  } finally {
    try {
      await prisma.$disconnect();
    } catch (_) {}
  }
})();
