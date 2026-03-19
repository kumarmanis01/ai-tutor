#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Development database reset + seed script.
 *
 * This is a living document: append new seed commands to the SEED_COMMANDS
 * array as additional child seed scripts are added over time.
 *
 * WHAT THIS DOES:
 * 1. Drops and recreates the dev database schema via `prisma migrate reset`.
 * 2. Applies all Prisma migrations via `prisma migrate dev`.
 * 3. Regenerates the Prisma client via `prisma generate`.
 * 4. Runs seed scripts in order:
 *    - scripts/seed-taxonomy.cjs
 *    - scripts/seed-taxonomy-launch-slice.ts
 *    - scripts/seed-misconceptions.ts
 *
 * SAFETY:
 * - Intended ONLY for local development. Do NOT run against production.
 * - This will irreversibly delete all data in the configured database.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/** Commands to run after migrations, in order. */
const SEED_COMMANDS = [
  ['node', ['scripts/seed-taxonomy.cjs']],
  ['npx', ['tsx', 'scripts/seed-taxonomy-launch-slice.ts']],
  ['npx', ['tsx', 'scripts/seed-misconceptions.ts']],
];

function run(cmd, args, options = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: ROOT,
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run in NODE_ENV=production. This script is dev-only.');
    process.exit(1);
  }

  console.log('=== Dev DB reset + seed ===');
  console.log('This will DROP all data in the configured database.');

  const prismaBin = path.resolve(ROOT, 'node_modules', '.bin', 'prisma');

  // 1) Reset DB (drop + reapply migrations)
  // Note: When run manually by a human, Prisma will prompt for confirmation.
  run(prismaBin, ['migrate', 'reset', '--force']);

  // 2) Ensure latest migrations applied (usually covered by reset, but explicit here)
  run(prismaBin, ['migrate', 'dev']);

  // 3) Regenerate Prisma client
  run(prismaBin, ['generate']);

  // 4) Run seed scripts in order
  for (const [cmd, args] of SEED_COMMANDS) {
    try {
      run(cmd, args);
    } catch (err) {
      console.error(`Seed command failed: ${cmd} ${args.join(' ')}`);
      console.error(err?.message || err);
      process.exit(1);
    }
  }

  console.log('\n✅ Dev DB reset and seed completed successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

