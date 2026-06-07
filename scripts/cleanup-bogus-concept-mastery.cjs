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

// Prisma 7 requires a non-empty PrismaClientOptions; pass the resolved
// DATABASE_URL explicitly so the script also works when the prisma schema
// would otherwise pick a different env binding.
if (!process.env.DATABASE_URL) {
  console.error('[cleanup] DATABASE_URL is not set; aborting');
  process.exit(1);
}
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: ['error'],
});

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

  const result = await prisma.studentConceptState.deleteMany({ where: filter });
  console.log(`[cleanup] deleted ${result.count} rows`);
}

main()
  .catch((err) => {
    console.error('[cleanup] failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
