/**
 * FILE OBJECTIVE:
 * - Small CLI to ensure a minimum number of MockExams per subject/grade/board.
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/ensure-mocks.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-16T10:05:00Z | copilot | created CLI wrapper for ensureMinimumMocks
 */

import minimist from 'minimist';
import ensureMinimumMocks from '@/lib/mock/ensureMocks';
import { logger } from '@/lib/logger';
import { fileURLToPath } from 'url';

async function main() {
  const argv = minimist(process.argv.slice(2));
  const min = Number(argv.min ?? argv.m ?? 5);
  const dryRun = !!argv['dry-run'] || !!argv['dry'] || !!argv.d;
  logger.info('ensure-mocks.start', { min });
  try {
    const result = await ensureMinimumMocks({ minPer: min, dryRun });
    logger.info('ensure-mocks.done', { createdCount: result.created.length, minPer: result.minPer });
    for (const c of result.created) {
      logger.info('ensure-mocks.created_item', c);
    }
    // Also print a concise JSON summary to stdout for operator verification
    // Print only first 100 created items to avoid huge output
    const summary = {
      minPer: result.minPer,
      createdCount: result.created.length,
      createdPreview: result.created.slice(0, 100),
    };
    // Use console.log so redirection captures this reliably
    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    logger.error('ensure-mocks.failed', { error: String(err) });
    process.exitCode = 2;
  }
}

const __isNodeEntry = (() => {
  try {
    return fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
})();

if (__isNodeEntry) {
  main().catch((e) => {
    logger.error('ensure-mocks.unhandled', { error: String(e) });
    process.exit(1);
  });
}
