/**
 * FILE OBJECTIVE:
 * - Ensure `worker/loop.ts` compiles without TypeScript errors.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/loop.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/AI_CONTENT_INDEX.md
 *
 * EDIT LOG:
 * - 2026-01-02T12:55:00Z | automation | added compile test for worker entry
 */

import { execSync } from 'child_process'
import { join } from 'path'

test('worker/loop.ts compiles', () => {
  const repoRoot = join(__dirname, '../../../')
  // Run TypeScript on the single file using the workers tsconfig.
  execSync('npx -y tsc --noEmit -p tsconfig.workers.json', { cwd: repoRoot, stdio: 'inherit' })
}, 30000)
