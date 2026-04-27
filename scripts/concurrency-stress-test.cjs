#!/usr/bin/env node
/**
 * scripts/concurrency-stress-test.cjs
 *
 * Simulate 20 parallel students performing randomized study actions.
 * Validations:
 *  - No unhandled promise rejections
 *  - No HTTP 500 responses
 *  - No duplicate StudentTopicMastery rows
 *  - No STM composite keys in Redis
 *  - No LearningSession with endedAt IS NULL and isCompleted = true
 *
 * Requirements:
 *  - A running Next.js server at BASE_URL (default http://localhost:3000)
 *  - NEXTAUTH_SECRET set to match server
 *  - DATABASE_URL pointing at same DB
 *  - REDIS_URL pointing at Redis
 *
 * Usage:
 *   node scripts/concurrency-stress-test.cjs
 *   BASE_URL=http://localhost:3000 NEXTAUTH_SECRET=... node scripts/concurrency-stress-test.cjs
 */
'use strict';

// Default test envs (use provided values when running locally)
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'spinzy academy secret';
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:spinzyacademy@localhost:5432/spinzy_dev';

// Load project env and validations (centralised bootstrap)
require('./bootstrap-env.cjs');

// Normalize REDIS reachability for local test runs: if REDIS_URL hostname
// is a Docker service name like 'redis' that doesn't resolve on host, fall
// back to localhost to avoid unhandled DNS errors during tests.
try {
  const dns = require('dns');
  const { URL } = require('url');
  const red = process.env.REDIS_URL;
  if (red) {
    try {
      const parsed = new URL(red);
      const host = parsed.hostname;
      dns.lookup(host, (err) => {
        if (err && err.code === 'ENOTFOUND') {
          console.warn(`Redis host '${host}' not resolvable -- falling back to 127.0.0.1`);
          try {
            const fallback = `redis://127.0.0.1:${parsed.port || 6379}`;
            process.env.REDIS_URL = fallback;
            console.warn(`Set REDIS_URL=${fallback} for this run`);
          } catch (_) {}
        }
      });
    } catch (e) {
      // ignore malformed URL
    }
  }
} catch (e) {
  // dns unavailable -- ignore
}

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Config
const BASE_URL = (process.env.BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
function getCliArg(name) {
  const eq = process.argv.find((a) => a.startsWith(name + '='));
  if (eq) return eq.split('=')[1];
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && process.argv.length > idx + 1) return process.argv[idx + 1];
  return undefined;
}

const USER_COUNT = parseInt(getCliArg('--users') || process.env.USER_COUNT || '20', 10) || 20;
const ACTIONS_PER_USER = parseInt(getCliArg('--actions') || process.env.ACTIONS_PER_USER || '25', 10) || 25;
const EMAIL_PREFIX = `concurrency-test-${Date.now()}`;

// Globals for stats
let http500Count = 0;
const requestErrors = [];
let unhandledRejectionCount = 0;

process.on('unhandledRejection', (err) => {
  unhandledRejectionCount++;
  console.error('UnhandledRejection:', err && err.stack ? err.stack : err);
});

// Load Prisma client (attempt common locations)
let prisma;
(function loadPrisma() {
  const candidates = [
    '../src/lib/prisma',
    '../lib/prisma',
    '../dist/lib/prisma',
    '../prisma/client',
    '../../lib/prisma',
  ];
  for (const c of candidates) {
    try {
      const p = require(path.join(__dirname, c));
      prisma = p.prisma || p.default || p;
      if (prisma) return;
    } catch (e) {
      // ignore
    }
  }
  console.error('Prisma client not found. Ensure @prisma/client is installed and reachable from scripts.');
  process.exit(1);
})();

// Fetch helper (supports global fetch or node-fetch fallback)
let _fetch = global.fetch;
if (!_fetch) {
  try {
    _fetch = require('node-fetch');
  } catch (e) {
    console.error('fetch not available and node-fetch not installed. Please run on Node >=18 or install node-fetch.');
    process.exit(1);
  }
}

async function getEncoder() {
  const mod = await import('next-auth/jwt');
  return mod.encode;
}

async function createSessionCookie(userId, email, name = 'Concurrency Test') {
  if (!NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET is not set');
  const encode = await getEncoder();
  const now = Math.floor(Date.now() / 1000);
  const token = await encode({
    token: { sub: userId, id: userId, email, name, role: 'user', iat: now, exp: now + 3600, jti: `test-${userId}-${now}` },
    secret: NEXTAUTH_SECRET,
    maxAge: 3600,
  });
  const cookieName = BASE_URL.startsWith('https') ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
  return `${cookieName}=${token}`;
}

async function apiGet(path, cookie) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await _fetch(url, { method: 'GET', headers: { Cookie: cookie, 'Content-Type': 'application/json' } });
    const body = await res.json().catch(() => null);
    if (res.status >= 500) http500Count++;
    return { status: res.status, body };
  } catch (e) {
    requestErrors.push({ url, error: e });
    return { status: 0, body: null, error: e };
  }
}

async function apiPost(path, cookie, payload) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await _fetch(url, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => null);
    if (res.status >= 500) http500Count++;
    return { status: res.status, body };
  } catch (e) {
    requestErrors.push({ url, error: e });
    return { status: 0, body: null, error: e };
  }
}

async function ensureUser(email, board, grade) {
  return prisma.user.upsert({
    where: { email },
    update: { board, grade: String(grade), subjects: [] },
    create: { email, language: 'en', board, grade: String(grade), subjects: [] },
  });
}

function randDelay() {
  const ms = 50 + Math.floor(Math.random() * 151); // 50-200ms
  return new Promise((res) => setTimeout(res, ms));
}

async function runStudentSimulation(user, cookie) {
  try {
    for (let i = 0; i < ACTIONS_PER_USER; i++) {
      const next = await apiGet('/api/home/next-action', cookie);
      if (next.status >= 500) {
        requestErrors.push({ user: user.id, path: '/api/home/next-action', status: next.status, body: next.body });
      }

      const body = next.body || {};
      // Heuristic: decide action type
      const actionKind = (body.kind || body.type || (body.action && body.action.type) || '').toLowerCase();
      if (!actionKind && body.action && typeof body.action === 'string') {
        // some APIs return action as string
        if (body.action.includes('practice')) actionKind = 'practice';
      }

      // If practice-like, attempt submit
      if (String(actionKind).includes('practice') || String(JSON.stringify(body)).toLowerCase().includes('practice')) {
        // best-effort payload
        const payload = { answers: [], meta: { simulated: true, studentId: user.id } };
        const p = await apiPost('/api/tests/submit', cookie, payload);
        if (p.status >= 500) requestErrors.push({ user: user.id, path: '/api/tests/submit', status: p.status, body: p.body });
      } else if (String(actionKind).includes('note') || String(JSON.stringify(body)).toLowerCase().includes('note')) {
        // attempt complete-action
        const payload = {};
        if (body && body.id) payload.id = body.id;
        else if (body && body.action && body.action.id) payload.id = body.action.id;
        const p = await apiPost('/api/home/complete-action', cookie, payload);
        if (p.status >= 500) requestErrors.push({ user: user.id, path: '/api/home/complete-action', status: p.status, body: p.body });
      } else {
        // Unknown action -- attempt a complete-action safely
        const payload = { id: body && body.id ? body.id : undefined };
        const p = await apiPost('/api/home/complete-action', cookie, payload);
        if (p.status >= 500) requestErrors.push({ user: user.id, path: '/api/home/complete-action', status: p.status, body: p.body });
      }

      await randDelay();
    }
  } catch (e) {
    requestErrors.push({ user: user.id, error: e });
  }
}

async function scanForDuplicateSTM() {
  // raw SQL: find studentId, topicId having count>1
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT "studentId", "topicId", COUNT(*) as cnt FROM "StudentTopicMastery" GROUP BY "studentId","topicId" HAVING COUNT(*) > 1`);
    return rows && rows.length ? rows : [];
  } catch (e) {
    // some dialects may require different quoting -- try lowercase
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT studentId, topicId, COUNT(*) as cnt FROM StudentTopicMastery GROUP BY studentId,topicId HAVING COUNT(*) > 1`);
      return rows && rows.length ? rows : [];
    } catch (err) {
      console.warn('Duplicate STM check failed:', err.message || err);
      return [{ error: err.message || String(err) }];
    }
  }
}

async function scanForSTMCompositeKeys() {
  // reuse ioredis
  let IORedis;
  try { IORedis = require('ioredis'); } catch (e) { return { error: 'ioredis not installed' }; }
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return { error: 'REDIS_URL missing' };
  // Use lazyConnect and attach an error handler to avoid unhandled ioredis errors
  const r = new IORedis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: true });
  const patterns = ['stm:*:composite', 'stm:composite:*', 'stm:*:composites'];
  const found = [];
  r.on('error', (err) => {
    found.push({ error: err && err.message ? err.message : String(err) });
  });
  try {
    try {
      await r.connect();
    } catch (connErr) {
      return { error: 'redis connection failed: ' + (connErr && connErr.message ? connErr.message : String(connErr)) };
    }
    for (const p of patterns) {
      let cursor = '0';
      do {
        const res = await r.scan(cursor, 'MATCH', p, 'COUNT', 100);
        cursor = res[0];
        const keys = res[1];
        if (keys && keys.length) found.push(...keys);
      } while (cursor !== '0');
    }
  } catch (e) {
    found.push({ error: e.message || String(e) });
  } finally {
    try { await r.disconnect(); } catch (_) {}
  }
  return found;
}

async function checkSessionsInconsistency() {
  try {
    const sessions = await prisma.learningSession.findMany({ where: { endedAt: null, isCompleted: true }, take: 50 });
    return sessions;
  } catch (e) {
    console.warn('LearningSession check failed:', e.message || e);
    return [{ error: e.message || String(e) }];
  }
}

async function cleanupTestUsers(emails) {
  try {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
  } catch (e) {
    console.warn('Cleanup users failed:', e.message || e);
  }
}

(async function main() {
  console.log('Starting concurrency stress test: users=', USER_COUNT, 'actionsPerUser=', ACTIONS_PER_USER);
  const createdEmails = [];
  const users = [];

  try {
    // Create users
    for (let i = 0; i < USER_COUNT; i++) {
      const email = `${EMAIL_PREFIX}-${i}@example.com`;
      createdEmails.push(email);
      const u = await ensureUser(email, 'CBSE', '6');
      users.push(u);
    }

    // Create cookies
    const cookies = {};
    for (const u of users) {
      try {
        const cookie = await createSessionCookie(u.id, u.email || `${u.id}@example.com`, u.name || 'Concurrency');
        cookies[u.id] = cookie;
      } catch (e) {
        console.error('Failed to create session cookie for', u.id, e && e.message ? e.message : e);
        requestErrors.push({ user: u.id, error: e });
      }
    }

    // Run simulations in parallel
    await Promise.all(users.map((u) => runStudentSimulation(u, cookies[u.id])));

    // Validations
    const duplicateSTMs = await scanForDuplicateSTM();
    const stmCompositeKeys = await scanForSTMCompositeKeys();
    const badSessions = await checkSessionsInconsistency();

    let failed = false;

    if (unhandledRejectionCount > 0) {
      console.error('Unhandled promise rejections detected:', unhandledRejectionCount);
      failed = true;
    }

    if (http500Count > 0) {
      console.error('HTTP 5xx responses detected:', http500Count);
      failed = true;
    }

    if (requestErrors.length > 0) {
      console.error('Request errors / failures:', requestErrors.length);
      // Print a sample
      console.error(JSON.stringify(requestErrors.slice(0, 10), null, 2));
      failed = true;
    }

    if (Array.isArray(duplicateSTMs) && duplicateSTMs.length > 0) {
      console.error('Duplicate StudentTopicMastery rows found:', duplicateSTMs.length);
      console.error(JSON.stringify(duplicateSTMs.slice(0, 10), null, 2));
      failed = true;
    }

    if (Array.isArray(stmCompositeKeys) && stmCompositeKeys.length > 0) {
      console.error('Found STM composite keys in Redis (examples):', stmCompositeKeys.slice(0, 10));
      failed = true;
    } else if (stmCompositeKeys && stmCompositeKeys.error) {
      console.warn('STM composite key scan error:', stmCompositeKeys.error);
    }

    if (Array.isArray(badSessions) && badSessions.length > 0) {
      console.error('Learning sessions inconsistent (endedAt=null && isCompleted=true):', badSessions.length);
      console.error(JSON.stringify(badSessions.slice(0, 10), null, 2));
      failed = true;
    }

    if (!failed) {
      console.log('CONCURRENCY TEST PASSED');
      // Cleanup
      await cleanupTestUsers(createdEmails);
      process.exit(0);
    }

    console.error('CONCURRENCY TEST FAILED');
    // Cleanup
    await cleanupTestUsers(createdEmails);
    process.exit(1);
  } catch (e) {
    console.error('Fatal error during concurrency test:', e && e.stack ? e.stack : e);
    await cleanupTestUsers(createdEmails);
    process.exit(1);
  } finally {
    try { await prisma.$disconnect(); } catch (_) {}
  }
})();
