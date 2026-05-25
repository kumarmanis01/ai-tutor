#!/usr/bin/env node
// Standalone CJS script -- no Prisma client dependency, uses pg + ioredis directly.
// Works on VPS without ts-node or Prisma client generation.
//
// Usage: node scripts/mark-admin.cjs <email>
'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const Redis = require('ioredis');

function loadEnv() {
  const root = path.resolve(__dirname, '..');
  const candidates = ['.env.production', '.env.local', '.env'];
  for (const name of candidates) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
    console.log(`[env] loaded ${file}`);
    break;
  }
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/mark-admin.cjs <user-email>');
    process.exit(1);
  }

  loadEnv();

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL is not set and could not be loaded from .env files');
    process.exit(1);
  }

  // --- DB update ---
  const db = new Client({ connectionString: dbUrl });
  await db.connect();
  try {
    const check = await db.query('SELECT id, email, role FROM "User" WHERE email = $1', [email]);
    if (check.rowCount === 0) {
      console.error(`ERROR: No user found with email: ${email}`);
      process.exit(1);
    }

    const current = check.rows[0];
    if (current.role === 'admin') {
      console.log(`[INFO] ${email} already has role=admin -- no change needed.`);
    } else {
      await db.query('UPDATE "User" SET role = $1 WHERE email = $2', ['admin', email]);
      console.log(`[INFO] ${email} updated from role=${current.role} to role=admin.`);
    }
  } finally {
    await db.end();
  }

  // --- Redis cache bust ---
  // The JWT callback caches role for up to 5 minutes. Without this del,
  // the user sees "no admin access" even after the DB is correct.
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[WARN] REDIS_URL not set -- skipping cache invalidation. The change will take effect within 5 minutes, or sooner if the user signs out and back in after the TTL expires.');
    return;
  }

  const cacheKey = `session:user:${email.toLowerCase()}`;
  const redis = new Redis.default(redisUrl, { lazyConnect: true, enableOfflineQueue: false });
  try {
    await redis.connect();
    await redis.del(cacheKey);
    console.log(`[INFO] Redis cache key deleted: ${cacheKey}`);
  } catch (e) {
    console.warn(`[WARN] Redis cache invalidation failed (${e.message}) -- change takes effect within 5 minutes.`);
  } finally {
    redis.disconnect();
  }
}

main().catch((e) => {
  console.error('[ERROR]', e.message || e);
  process.exit(1);
});
