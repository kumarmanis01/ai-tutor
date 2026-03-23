/* eslint-disable no-console */
/**
 * Prisma generate wrapper with retry on Windows EPERM file locks.
 *
 * Why this exists:
 * - On Windows, `prisma generate` can fail with:
 *   EPERM: operation not permitted, rename ...query_engine-windows.dll.node.tmp -> ...query_engine-windows.dll.node
 *   when the engine file is temporarily locked (running node/worker, antivirus, indexer).
 *
 * Contract:
 * - NEVER suppress failures: we retry a few times and log actionable guidance.
 * - Exit non-zero if generation still fails.
 *
 * IMPORTANT: Uses the locally installed prisma binary (node_modules/.bin/prisma).
 * Never use `npx prisma` -- npx can resolve a globally cached v7 binary when
 * node_modules/.bin/prisma doesn't exist yet, causing a version mismatch against
 * the pinned prisma@6.19.1.
 */

const { spawnSync } = require('child_process');
const path = require('path');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const PRISMA_BIN = path.resolve(__dirname, '..', 'node_modules', '.bin', 'prisma');

function runOnce() {
  const res = spawnSync(PRISMA_BIN, ['generate'], {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });
  return res.status ?? 1;
}

async function main() {
  const maxAttempts = Number(process.env.PRISMA_GENERATE_MAX_ATTEMPTS || 5);
  const baseDelayMs = Number(process.env.PRISMA_GENERATE_RETRY_DELAY_MS || 1000);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const code = runOnce();
    if (code === 0) return;

    const isLast = attempt === maxAttempts;
    console.error(`[prisma-generate] attempt ${attempt}/${maxAttempts} failed (exit ${code}).`);

    if (isLast) {
      console.error(
        [
          '',
          '[prisma-generate] Giving up after retries.',
          'If you see EPERM rename errors on Windows, stop any running processes that may be using Prisma (next dev, worker:dev, scheduler),',
          'then retry the build. Antivirus/indexing can also temporarily lock the Prisma engine DLL.',
          '',
        ].join('\n')
      );
      process.exit(code);
    }

    const delay = Math.min(baseDelayMs * attempt, 10_000);
    console.error(`[prisma-generate] retrying in ${delay}ms...`);
    // eslint-disable-next-line no-await-in-loop
    await sleep(delay);
  }
}

main().catch((e) => {
  console.error('[prisma-generate] fatal', String(e));
  process.exit(1);
});
