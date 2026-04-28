/**
 * FILE OBJECTIVE:
 * - Verify that the Docker runbook documents the rebuilt hot-reload development workflow.
 *
 * LINKED UNIT TEST:
 * - tests/unit/docs/docker_rules.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T00:00:00Z | copilot | update assertions for the rebuilt Docker hot-reload runbook
 */

import fs from 'fs';
import path from 'path';

describe('Docker runbook', () => {
  it('describes the hot-reload startup flow', () => {
    const file = path.join(__dirname, '..', '..', '..', 'docs', 'v2', 'docker_rules.md');
    const content = fs.readFileSync(file, 'utf8');

    expect(content).toContain('docker compose up --build');
    expect(content).toContain('tsx watch');
    expect(content).toContain('Confirm the browser refreshes without rebuilding the image.');
  });
});
