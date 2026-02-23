#!/usr/bin/env node
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

function fail(msg) {
  console.error('PRELAUNCH CHECK FAILED:', msg);
  process.exitCode = 1;
}

(async function main() {
  try {
    // 1. NEXTAUTH_SECRET
    if (!process.env.NEXTAUTH_SECRET) {
      fail('NEXTAUTH_SECRET is not set in environment');
      return;
    }

    // 2. Redis
    let IORedis;
    try {
      IORedis = require('ioredis');
    } catch (e) {
      fail('ioredis not installed');
      return;
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      fail('REDIS_URL is not set in environment');
      return;
    }

    const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    try {
      const pong = await redis.ping();
      if (pong !== 'PONG') {
        fail('Redis ping did not return PONG');
        await redis.disconnect();
        return;
      }
    } catch (e) {
      fail('Redis ping failed: ' + (e.message || e));
      try { await redis.disconnect(); } catch (_) {}
      return;
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
          const topicCount = await prismaClient.topicDef.count({ where: { chapter: { subjectId: s.id }, lifecycle: 'active' } });
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

    // 5. STM composite key scan
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
            await redis.disconnect();
            return;
          }
        } while (cursor !== '0');
      }
    } catch (e) {
      fail('Redis key scan failed: ' + (e.message || e));
      try { await redis.disconnect(); } catch (_) {}
      return;
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
