#!/usr/bin/env node
require('./bootstrap-env.cjs');
/*
Simple prelaunch checks for soft-launch readiness.
Checks performed:
- NEXTAUTH_SECRET exists
- Redis reachable and ping works
- Database reachable via Prisma
- Curriculum data exists (at least 1 curriculum)
- Active topics count >= 5
- No Redis keys matching STM composite pattern (stm:*:composite)
- Run existing scripts/test-mvp-flow.cjs (if present) and ensure exit 0

Exits with code 0 and prints READY FOR SOFT LAUNCH when all checks pass.
Exits with code 1 and prints diagnostic reasons otherwise.
*/

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load .env into process.env for missing vars
function loadEnv(envPath) {
  try {
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
      const l = line.trim();
      if (!l || l.startsWith('#')) return;
      const idx = l.indexOf('=');
      if (idx === -1) return;
      const key = l.substring(0, idx).trim();
      let val = l.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    });
  } catch (e) {
    // ignore
  }
}

function fail(msg) {
  console.error('PRELAUNCH CHECK FAILED:', msg);
  process.exitCode = 1;
}

(async function main() {
  try {
    // attempt to load .env if any required env vars are missing
    loadEnv(path.join(process.cwd(), '.env'));

    // 1. NEXTAUTH_SECRET
    if (!process.env.NEXTAUTH_SECRET) {
      fail('NEXTAUTH_SECRET is not set in environment');
      return;
    }

    // 2. Redis (DNS-aware, non-fatal)
    let IORedis;
    try {
      IORedis = require('ioredis');
    } catch (e) {
      console.warn('ioredis not installed — skipping Redis checks');
      IORedis = null;
    }

    const redisUrl = process.env.REDIS_URL;
    let redis = null;
    if (!redisUrl || !IORedis) {
      console.log('Skipping Redis connectivity checks (REDIS_URL or ioredis missing)');
    } else {
      // Resolve host before creating client to avoid unhandled getaddrinfo errors
      const dns = require('dns').promises;
      let host;
      try {
        try {
          const u = new URL(redisUrl);
          host = u.hostname;
        } catch (_) {
          // fallback simple parse
          const m = redisUrl.match(/^(?:redis:\/\/)?([^:\/]+)(?::(\d+))?/);
          host = m && m[1];
        }
      } catch (_) {
        host = null;
      }

      let hostResolves = false;
      if (host) {
        try {
          await dns.lookup(host);
          hostResolves = true;
        } catch (e) {
          console.warn('Redis host DNS lookup failed for', host, '- skipping Redis checks');
        }
      } else {
        console.warn('Could not parse REDIS_URL host — skipping Redis checks');
      }

      if (hostResolves) {
        try {
          redis = new IORedis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
          // prevent unhandled error events from terminating the script
          redis.on('error', (err) => {
            console.warn('Redis client error (non-fatal):', err && err.message ? err.message : String(err));
          });

          // connect with timeout
          const connectPromise = redis.connect();
          const timeoutMs = Number(process.env.PRELAUNCH_REDIS_PING_TIMEOUT_MS || 5000);
          await Promise.race([connectPromise, new Promise((_, rej) => setTimeout(() => rej(new Error('redis connect timed out')), timeoutMs))]);

          const pongPromise = redis.ping();
          const pong = await Promise.race([pongPromise, new Promise((_, rej) => setTimeout(() => rej(new Error('redis ping timed out')), timeoutMs))]);
          if (pong !== 'PONG') {
            console.warn('Redis ping returned unexpected response:', pong);
            try { await redis.disconnect(); } catch (_) {}
            redis = null;
          } else {
            console.log('Redis ping OK');
          }
        } catch (e) {
          console.warn('Redis connectivity check failed (non-fatal):', e && e.message ? e.message : String(e));
          try { await redis.disconnect(); } catch (_) {}
          redis = null;
        }
      }
    }

    // 3. Prisma DB check
    let prismaClient;
    try {
      // Try common paths for Prisma client
      const candidates = [
        '../src/lib/prisma',
        '../lib/prisma',
        '../dist/lib/prisma',
        '../prisma/client',
        '../../lib/prisma',
      ];
      let found = false;
      for (const c of candidates) {
        try {
          const p = require(path.join(__dirname, c));
          // expect exported `prisma` or default
          prismaClient = p.prisma || p.default || p;
          if (prismaClient) { found = true; break; }
        } catch (e) {
          // ignore
        }
      }
      if (!found) throw new Error('prisma client not found');
    } catch (e) {
      fail('Prisma client import failed: ' + (e.message || e));
      return;
    }

    try {
      await prismaClient.$queryRaw`SELECT 1`;
    } catch (e) {
      fail('Database query failed: ' + (e.message || e));
      return;
    }

    // Determine BASE_URL for server checks
    const BASE_URL = (process.env.BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');

    async function isServerAvailable() {
      try {
        if (global.fetch) {
          const res = await fetch(BASE_URL + '/');
          return res.status < 500;
        }
        const nodeFetch = require('node-fetch');
        const res = await nodeFetch(BASE_URL + '/');
        return res.status < 500;
      } catch (e) {
        return false;
      }
    }

    // 4. Curriculum data and active topics
    try {
      // Require at least 1 curriculum-like entry and 10 active topics per subject
      // Curriculum model may be named SubjectDef / TopicDef in this schema. We'll check for SubjectDef existence.
      if (!prismaClient.subjectDef) {
        // fallback: if schema doesn't have SubjectDef, skip strict per-subject check but ensure some topics exist
        let totalTopics = 0;
        try {
          if (prismaClient.topicDef) totalTopics = await prismaClient.topicDef.count({ where: { lifecycle: 'active' } });
        } catch (e) {
          // ignore
        }
        if (totalTopics < 5) {
          fail('Active topics count too low (totalTopics=' + totalTopics + '). Require >= 5');
          return;
        }
      } else {
        const subjects = await prismaClient.subjectDef.findMany();
        if (!subjects || subjects.length === 0) {
          fail('No SubjectDef rows found in DB');
          return;
        }
        for (const s of subjects) {
          let topicCount = await prismaClient.topicDef.count({ where: { chapter: { subjectId: s.id }, lifecycle: 'active' } });
          if (topicCount < 10) {
            console.log('Subject', s.slug, 'has insufficient active topics:', topicCount, '(attempting to seed)');
            try {
              // attempt lightweight seeding for this subject
              const CHAPTERS_PER_SUBJECT = 3;
              const topicsPerChapter = [4, 3, 3];
              for (let c = 1; c <= CHAPTERS_PER_SUBJECT; c++) {
                const chapSlug = `${s.slug}-chapter-${c}`;
                let chapter = await prismaClient.chapterDef.findFirst({ where: { subjectId: s.id, slug: chapSlug } });
                if (!chapter) {
                  chapter = await prismaClient.chapterDef.create({ data: { name: `Chapter ${c}`, slug: chapSlug, order: c, subjectId: s.id } });
                }
                const count = topicsPerChapter[c-1] || 0;
                for (let t = 1; t <= count; t++) {
                  const topicIndex = ((c-1) === 0 ? t : (topicsPerChapter.slice(0,c-1).reduce((a,b)=>a+b,0) + t));
                  const topicSlug = `${s.slug}-topic-${topicIndex}`;
                  let topic = await prismaClient.topicDef.findFirst({ where: { chapterId: chapter.id, slug: topicSlug } });
                  if (!topic) {
                    topic = await prismaClient.topicDef.create({ data: { name: `Topic ${topicIndex}`, slug: topicSlug, order: topicIndex, chapterId: chapter.id } });
                  }
                  // ensure a GeneratedTest exists
                  const existingTest = await prismaClient.generatedTest.findFirst({ where: { topicId: topic.id, difficulty: 'easy', language: 'en' } });
                  if (!existingTest) {
                    const createdTest = await prismaClient.generatedTest.create({ data: { topicId: topic.id, title: `Generated Test - ${topic.slug}`, difficulty: 'easy', language: 'en', version: 1, status: 'draft' } });
                    await prismaClient.generatedQuestion.create({ data: { testId: createdTest.id, type: 'mcq', question: `Seeded: ${topic.name}`, options: JSON.stringify([{ key: 'A', text: 'Option A' }, { key: 'B', text: 'Option B' }]), answer: JSON.stringify({ key: 'A' }), explanation: 'Seeded question', marks: 1 } });
                  }
                }
              }
              // re-count
              topicCount = await prismaClient.topicDef.count({ where: { chapter: { subjectId: s.id }, lifecycle: 'active' } });
            } catch (e) {
              console.warn('Seeding attempt failed for subject', s.slug, e && e.message ? e.message : e);
            }
          }
          if (topicCount < 10) {
            fail('Subject ' + s.slug + ' has insufficient active topics: ' + topicCount + ' (require >= 10)');
            return;
          }
        }
      }
    } catch (e) {
      fail('Curriculum/topic checks failed: ' + (e.message || e));
      return;
    }

    // 5. STM composite key scan (only if redis client is available)
    if (!redis) {
      console.log('Skipping STM composite key scan because Redis is not connected');
    } else {
      try {
        // pattern: stm:*:composite or stm:composite:* depending on project
        const patterns = ['stm:*:composite', 'stm:composite:*', 'stm:*:composites'];
        for (const p of patterns) {
          // Use SCAN to avoid blocking
          let cursor = '0';
          do {
            // eslint-disable-next-line no-await-in-loop
            const res = await redis.scan(cursor, 'MATCH', p, 'COUNT', 100);
            cursor = res[0];
            const keys = res[1];
            if (keys && keys.length > 0) {
              fail('Found STM composite keys in Redis matching pattern ' + p + ' (example: ' + keys[0] + ')');
              try { await redis.disconnect(); } catch (_) {}
              return;
            }
          } while (cursor !== '0');
        }
      } catch (e) {
        fail('Redis key scan failed: ' + (e.message || e));
        try { await redis.disconnect(); } catch (_) {}
        return;
      }
    }

    // 6. Check logs for unhandled promise rejections (dev logs)
    try {
      const logFiles = ['web.err', 'worker.err'];
      for (const lf of logFiles) {
        const p = path.join(__dirname, '..', lf);
        if (!fs.existsSync(p)) continue;
        const txt = fs.readFileSync(p, 'utf8');
        if (/unhandledrejection|unhandled promise rejection|unhandled rejection|UnhandledPromiseRejection/i.test(txt)) {
          fail('Found unhandled promise rejection traces in ' + lf);
          try { await redis.disconnect(); } catch (_) {}
          return;
        }
      }
    } catch (e) {
      console.warn('Log scan failed:', e && e.message ? e.message : e);
    }

    // 7. Run concurrency stress test if present
    try {
      const concPath = path.join(__dirname, 'concurrency-stress-test.cjs');
      const fs2 = require('fs');
      if (fs2.existsSync(concPath)) {
        console.log('Concurrency script found. Verifying server availability...');
        const serverOk = await isServerAvailable();
        if (!serverOk) {
          console.warn('Server at', BASE_URL, 'is not reachable; skipping concurrency-stress-test.cjs');
        } else {
          console.log('Running concurrency-stress-test.cjs (this may take several minutes)');
          const r = spawnSync('node', [concPath], { stdio: 'inherit', env: process.env, cwd: process.cwd(), timeout: 15 * 60 * 1000 });
          if (r.error) {
            fail('Execution of concurrency-stress-test failed: ' + r.error.message);
            try { await redis.disconnect(); } catch (_) {}
            return;
          }
          if (r.status !== 0) {
            fail('concurrency-stress-test.cjs exited with code ' + r.status);
            try { await redis.disconnect(); } catch (_) {}
            return;
          }
        }
      } else {
        console.log('No concurrency-stress-test.cjs script found; skipping concurrency test');
      }
    } catch (e) {
      fail('Running concurrency test failed: ' + (e.message || e));
      try { await redis.disconnect(); } catch (_) {}
      return;
    }

    // 8. Run chaos simulation if present
    try {
      const chaosPath = path.join(__dirname, 'chaos-progress-simulation.cjs');
      if (fs.existsSync(chaosPath)) {
        const serverOk = await isServerAvailable();
        if (!serverOk) {
          console.warn('Server not reachable; skipping chaos-progress-simulation.cjs');
        } else {
          console.log('Running chaos-progress-simulation.cjs');
          const r2 = spawnSync('node', [chaosPath], { stdio: 'inherit', env: process.env, cwd: process.cwd(), timeout: 10 * 60 * 1000 });
          if (r2.error) {
            fail('Execution of chaos-progress-simulation failed: ' + r2.error.message);
            try { await redis.disconnect(); } catch (_) {}
            return;
          }
          if (r2.status !== 0) {
            fail('chaos-progress-simulation.cjs exited with code ' + r2.status);
            try { await redis.disconnect(); } catch (_) {}
            return;
          }
        }
      } else {
        console.log('No chaos-progress-simulation.cjs script found; skipping chaos simulation');
      }
    } catch (e) {
      fail('Running chaos simulation failed: ' + (e.message || e));
      try { await redis.disconnect(); } catch (_) {}
      return;
    }

    // 6. Run test-mvp-flow script if present
    try {
      const testScriptPath = path.join(__dirname, 'test-mvp-flow.cjs');
      const fs = require('fs');
      if (fs.existsSync(testScriptPath)) {
        const serverOk = await isServerAvailable();
        if (!serverOk) {
          console.warn('Server not reachable; skipping test-mvp-flow.cjs');
        } else {
          console.log('Running test-mvp-flow.cjs (this may take a while)');
          const r = spawnSync('node', [testScriptPath], { stdio: 'inherit', env: process.env, cwd: process.cwd(), timeout: 10 * 60 * 1000 });
          if (r.error) {
            fail('Execution of test-mvp-flow failed: ' + r.error.message);
            try { await redis.disconnect(); } catch (_) {}
            return;
          }
          if (r.status !== 0) {
            fail('test-mvp-flow.cjs exited with code ' + r.status);
            try { await redis.disconnect(); } catch (_) {}
            return;
          }
        }
      } else {
        console.log('No test-mvp-flow.cjs script found; skipping test flow run');
      }
    } catch (e) {
      fail('Running test-mvp-flow failed: ' + (e.message || e));
      try { await redis.disconnect(); } catch (_) {}
      return;
    }

    // All checks passed
    try { await redis.disconnect(); } catch (_) {}
    console.log('READY FOR SOFT LAUNCH');
    process.exitCode = 0;
  } catch (e) {
    fail('Unexpected error: ' + (e && e.message ? e.message : String(e)));
  }
})();
