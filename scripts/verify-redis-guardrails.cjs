#!/usr/bin/env node
/**
 * Redis & Infra Guardrails verifier (PreLaunch Gap Analysis - Week 1).
 *
 * Checks:
 * - appendonly == yes
 * - maxmemory-policy == volatile-lru
 * - basic key write/read survives reconnect
 *
 * Usage:
 *   node scripts/verify-redis-guardrails.cjs
 *
 * Notes:
 * - This script cannot fully validate failover behavior by itself (that requires
 *   your HA Redis setup to trigger a failover). See printed manual steps.
 */
require('dotenv').config({ path: '.env' });
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
// Strict mode should be ON in CI (and optionally anywhere via STRICT_REDIS_CONFIG=1).
// NOTE: We intentionally do NOT key off NODE_ENV because local .env files often set it
// inconsistently, and managed Redis services may not allow CONFIG verification anyway.
const STRICT_REDIS_CONFIG = process.env.STRICT_REDIS_CONFIG === '1' || process.env.CI === 'true';

function fail(msg) {
  console.error(`❌ redis-guardrails: ${msg}`);
  process.exitCode = 2;
}

function warn(msg) {
  console.warn(`⚠️ redis-guardrails: ${msg}`);
}

async function main() {
  const client = new Redis(REDIS_URL);

  try {
    const pong = await client.ping();
    if (pong !== 'PONG') fail(`PING expected PONG, got ${String(pong)}`);

    // Managed Redis (e.g. Redis Cloud) may block CONFIG; treat as warning unless strict mode is enabled.
    let aof = null;
    let policy = null;
    try {
      const appendonly = await client.config('GET', 'appendonly');
      const maxmemoryPolicy = await client.config('GET', 'maxmemory-policy');
      aof = appendonly?.[1] ?? null;
      policy = maxmemoryPolicy?.[1] ?? null;
      console.log('redis-guardrails: appendonly =', aof);
      console.log('redis-guardrails: maxmemory-policy =', policy);

      if (STRICT_REDIS_CONFIG) {
        if (aof !== 'yes') fail('appendonly must be yes (AOF enabled)');
        if (policy !== 'volatile-lru') fail('maxmemory-policy must be volatile-lru');
      } else {
        if (aof !== 'yes') warn('appendonly is not yes (local dev ok; prod should enable AOF)');
        if (policy !== 'volatile-lru')
          warn('maxmemory-policy is not volatile-lru (local dev ok; prod should use volatile-lru)');
      }
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      if (STRICT_REDIS_CONFIG) {
        fail(`CONFIG check failed in strict mode: ${msg}`);
      } else {
        console.warn(`⚠️ redis-guardrails: CONFIG checks unavailable (managed Redis?): ${msg}`);
        console.warn('⚠️ redis-guardrails: proceeding with connectivity + durability checks only');
      }
    }

    // Basic reconnect durability check (not a failover test).
    const key = `guardrail:session:test:${Date.now()}`;
    await client.set(key, 'ok', 'EX', 120);
    const v1 = await client.get(key);
    if (v1 !== 'ok') fail('failed to read back test key after SET');

    await client.quit();

    const client2 = new Redis(REDIS_URL);
    const v2 = await client2.get(key);
    if (v2 !== 'ok') fail('failed to read back test key after reconnect');
    await client2.quit();

    console.log('✅ redis-guardrails: connectivity + config + reconnect check passed');

    console.log('\nManual failover test (run in your HA env):');
    console.log(`- Step 1: SET ${key} ok EX 600`);
    console.log('- Step 2: Trigger a failover (provider / Sentinel / cluster).');
    console.log(`- Step 3: GET ${key} (should still be "ok").`);
    console.log('- Step 4: Repeat with several session-like keys + TTLs; confirm none are lost.');
    if (!STRICT_REDIS_CONFIG && (aof === null || policy === null)) {
      console.log('\nManaged Redis note:');
      console.log(
        '- Your provider may not allow CONFIG verification; ensure persistence/eviction via provider settings.'
      );
      console.log(
        '- You can force strict verification by setting STRICT_REDIS_CONFIG=1 (only if CONFIG is permitted).'
      );
    }
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  } finally {
    client.disconnect();
  }
}

main();
