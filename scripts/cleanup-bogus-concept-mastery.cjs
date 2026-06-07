#!/usr/bin/env node
// One-shot cleanup for StudentConceptState rows seeded with fabricated mastery
// by the old diagnosticBootstrapWorker behaviour. Those rows have masteryScore
// 0.3 (no-answer baseline / proactive bootstrap) or 0.5 (partial abandon) AND
// attemptCount = 0, because no real answer event ever updated them. They cause
// the dashboard's "Chapter mastery" panel to show 30%/50% on chapters the
// student never actually attempted.
//
// Usage:
//   node scripts/cleanup-bogus-concept-mastery.cjs            # dry run
//   node scripts/cleanup-bogus-concept-mastery.cjs --apply    # delete rows
//
// Safe to re-run: the WHERE clause never matches rows produced by the new
// worker (which only creates rows for concepts with real answer evidence and
// always sets attemptCount = 1).
'use strict';

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// ioredis is the same client the app uses (see lib/redis.ts). We pull it in
// only to flush the readiness cache keys for affected students after the
// delete -- otherwise Redis serves stale "50%" results for up to an hour.
let IORedis = null;
try {
  IORedis = require('ioredis');
} catch (_e) {
  // Optional: if ioredis isn't installed, the script still runs the DB
  // cleanup; the cache will just self-expire (TTL 3600s).
}

function loadEnvFileIfPresent() {
  try {
    const root = path.resolve(__dirname, '..');
    const candidates = ['.env.production', '.env.local', '.env'];
    for (const name of candidates) {
      const p = path.join(root, name);
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, 'utf8');
      for (let line of raw.split(/\r?\n/)) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        const m = line.match(/^([^=\s]+)=((?:".*")|(?:'.*')|.*)$/);
        if (!m) continue;
        const key = m[1];
        let val = m[2];
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (typeof process.env[key] === 'undefined' || process.env[key] === '') {
          process.env[key] = val;
        }
      }
      console.log(`[env-loader] loaded ${p}`);
      break;
    }
  } catch (e) {
    console.warn('[env-loader] failed to load .env file', e && e.message);
  }
}

loadEnvFileIfPresent();

// Prisma 7 dropped the `datasources` option and now requires an adapter
// (or accelerateUrl) on PrismaClient. The app already uses @prisma/adapter-pg
// (see lib/prisma.ts) -- mirror that wiring here so the script doesn't drift
// from production engine settings.
if (!process.env.DATABASE_URL) {
  console.error('[cleanup] DATABASE_URL is not set; aborting');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: ['error'],
});

async function flushReadinessCacheForStudents(studentIds) {
  if (!IORedis) {
    console.log('[cleanup] ioredis not available -- skipping readiness cache flush (TTL is 1h)');
    return;
  }
  if (!process.env.REDIS_URL) {
    console.log('[cleanup] REDIS_URL not set -- skipping readiness cache flush');
    return;
  }
  const redis = new IORedis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    let deleted = 0;
    for (const studentId of studentIds) {
      // Match readiness:${studentId}:${subjectId} keys via SCAN to avoid blocking Redis on a large keyspace.
      const pattern = `readiness:${studentId}:*`;
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        if (keys.length > 0) {
          deleted += await redis.del(...keys);
        }
      } while (cursor !== '0');
    }
    console.log(`[cleanup] readiness cache keys deleted: ${deleted}`);
  } finally {
    redis.disconnect();
  }
}

async function main() {
  const apply = process.argv.includes('--apply');

  const filter = {
    attemptCount: 0,
    masteryScore: { in: [0.3, 0.5] },
  };

  const total = await prisma.studentConceptState.count({ where: filter });
  console.log(`[cleanup] candidate rows: ${total}`);

  if (total === 0) {
    console.log('[cleanup] nothing to do');
    return;
  }

  const byScore = await prisma.studentConceptState.groupBy({
    by: ['masteryScore'],
    where: filter,
    _count: { _all: true },
  });
  for (const row of byScore) {
    console.log(`[cleanup]  masteryScore=${row.masteryScore} count=${row._count._all}`);
  }

  if (!apply) {
    console.log('[cleanup] dry run -- pass --apply to delete these rows');
    return;
  }

  // Capture the affected studentIds before delete so we can invalidate the
  // matching readiness cache keys afterwards. groupBy keeps the result set
  // small even on large tables.
  const affected = await prisma.studentConceptState.groupBy({
    by: ['studentId'],
    where: filter,
  });
  const studentIds = affected.map((r) => r.studentId);
  console.log(`[cleanup] affected students: ${studentIds.length}`);

  const result = await prisma.studentConceptState.deleteMany({ where: filter });
  console.log(`[cleanup] deleted ${result.count} rows`);

  await flushReadinessCacheForStudents(studentIds).catch((err) => {
    console.warn('[cleanup] readiness cache flush failed (rows already deleted):', err && err.message);
  });
}

main()
  .catch((err) => {
    console.error('[cleanup] failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end().catch(() => undefined);
  });
