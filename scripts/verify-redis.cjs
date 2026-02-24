#!/usr/bin/env node
/**
 * Simple Redis connectivity verifier used by local prelaunch checks.
 * Exits 0 on successful PONG, non-zero otherwise.
 */
require('dotenv').config({ path: '.env' });
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const TIMEOUT_MS = 5000;

async function main() {
  const client = new Redis(REDIS_URL, { lazyConnect: true });

  let timer = setTimeout(() => {
    console.error('verify-redis: connection timed out');
    client.disconnect();
    process.exit(2);
  }, TIMEOUT_MS);

  client.on('error', (err) => {
    console.error('verify-redis: redis error ->', err && err.message ? err.message : err);
  });

  try {
    await client.connect();
    const pong = await client.ping();
    clearTimeout(timer);
    console.log('verify-redis: PING ->', pong);
    await client.quit();
    process.exit(pong === 'PONG' ? 0 : 2);
  } catch (err) {
    clearTimeout(timer);
    console.error('verify-redis: failed ->', err && err.message ? err.message : err);
    client.disconnect();
    process.exit(2);
  }
}

main();
