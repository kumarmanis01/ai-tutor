/**
 * FILE OBJECTIVE:
 * - Guardrail tests for the Husky pre-commit hook contract and commit-time smart-quote flow.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T00:00:00Z | copilot | add pre-commit hook audit assertions for smart-quote fix/check flow and duplicate bootstrap removal
 */

import fs from 'fs';
import path from 'path';

describe('pre-commit hook audit', () => {
  const hookPath = path.join(process.cwd(), '.husky', 'pre-commit');
  const hook = fs.readFileSync(hookPath, 'utf8');

  it('should contain only one husky bootstrap include', () => {
    const includeLine = '. "$(dirname -- "$0")/_/husky.sh"';
    const matches = hook.split('\n').filter((line) => line.trim() === includeLine);
    expect(matches).toHaveLength(1);
  });

  it('should run lint-staged smart-quote auto-fix before smart-quote preflight check', () => {
    expect(hook).toContain('npx --no-install lint-staged');
    expect(hook).toContain('npm run preflight:smart-quotes');

    const lintStagedIdx = hook.indexOf('npx --no-install lint-staged');
    const preflightIdx = hook.indexOf('npm run preflight:smart-quotes');
    expect(lintStagedIdx).toBeGreaterThan(-1);
    expect(preflightIdx).toBeGreaterThan(-1);
    expect(lintStagedIdx).toBeLessThan(preflightIdx);
  });

  it('should explicitly log that --no-verify bypasses pre-commit gates', () => {
    expect(hook).toContain('using --no-verify bypasses this hook entirely');
  });
});
