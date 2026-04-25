/**
 * FILE OBJECTIVE:
 * - Run `ensureMinimumMocks` (dry-run) and write a UTF-8 JSON summary to `tmp/ensure-mocks-summary.json`.
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/run-ensure-mocks-out.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-16T12:50:00Z | copilot | added UTF-8 runner to capture dry-run summary reliably
 */

import fs from 'fs';
import path from 'path';
import ensureMinimumMocks from '@/lib/mock/ensureMocks';

async function main() {
  const minPer = Number(process.env.MIN_PER ?? 5);
  const res = await ensureMinimumMocks({ minPer, dryRun: true });
  const out = {
    minPer: res.minPer,
    createdCount: res.created.length,
    preview: res.created.slice(0, 50),
  };
  const outPath = path.join('tmp', 'ensure-mocks-summary.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  // Echo a short confirmation to stdout
  console.log('WROTE', outPath);
}

main().catch((e) => {
  console.error('run-ensure-mocks-out failed', String(e));
  process.exit(2);
});
