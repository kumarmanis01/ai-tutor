/**
 * FILE OBJECTIVE:
 * - Verify the Docker Compose file defines the rebuilt local hot-reload stack.
 *
 * LINKED UNIT TEST:
 * - tests/unit/docs/docker_compose.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T00:00:00Z | copilot | add regression coverage for the rebuilt Docker Compose workflow
 */

import fs from 'fs';
import path from 'path';

describe('docker-compose.yml', () => {
  it('uses the shared Docker dev image and watch-based commands', () => {
    const file = path.join(__dirname, '..', '..', '..', 'docker-compose.yml');
    const content = fs.readFileSync(file, 'utf8');

    expect(content).toContain('dockerfile: docker/Dockerfile.dev');
    expect(content).toContain('npx tsx watch worker/dev-entry.ts --type content-hydration');
    expect(content).toContain('npx tsx watch worker/scheduler.ts');
    expect(content).toContain("- '3000:3000'");
  });
});