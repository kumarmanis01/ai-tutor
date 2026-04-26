/**
 * FILE OBJECTIVE:
 * - Assert critical deploy script observability and safety gates remain present.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T00:00:00Z | copilot | add deploy script guardrail tests for logging, prune verification, and dist specifier gate
 * - 2026-04-26T00:00:00Z | copilot | add assertions for compact deploy summary in success and failure paths
 */

import fs from 'fs';
import path from 'path';

describe('deploy-and-run.sh guardrails', () => {
  const scriptPath = path.join(process.cwd(), 'scripts', 'deploy-and-run.sh');
  const script = fs.readFileSync(scriptPath, 'utf8');

  it('should mirror output to a persistent deploy log file', () => {
    expect(script).toContain('DEPLOY_LOG=');
    expect(script).toContain('exec > >(tee -a "${DEPLOY_LOG}") 2>&1');
  });

  it('should include a global ERR trap with failed command context', () => {
    expect(script).toContain('trap \'on_error $? $LINENO "${BASH_COMMAND}"\' ERR');
    expect(script).toContain('Failed command: ${failed_cmd}');
  });

  it('should explicitly verify devDependencies are pruned', () => {
    expect(script).toContain('npm prune --omit=dev');
    expect(script).toContain('FATAL: devDependencies still installed after prune');
  });

  it('should gate dist output on explicit runtime import specifiers', () => {
    expect(script).toContain('step "7b — Verify dist import specifiers"');
    expect(script).toContain('FATAL: Found extensionless relative imports in dist output.');
  });

  it('should print compact deploy summaries for success and failure paths', () => {
    expect(script).toContain('print_deploy_summary()');
    expect(script).toContain('print_deploy_summary "SUCCESS"');
    expect(script).toContain('print_deploy_summary "FAILED_HEALTHCHECK"');
    expect(script).toContain('print_deploy_summary "FAILED"');
    expect(script).toContain('===== DEPLOY SUMMARY =====');
  });
});
