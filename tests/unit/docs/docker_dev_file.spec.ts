/**
 * FILE OBJECTIVE:
 * - Verify the shared Docker development image installs dependencies once and defaults to the local dev server.
 *
 * LINKED UNIT TEST:
 * - tests/unit/docs/docker_dev_file.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T00:00:00Z | copilot | add regression coverage for the shared Docker development image
 */

import fs from 'fs';
import path from 'path';

describe('docker/Dockerfile.dev', () => {
  it('installs npm dependencies and defaults to npm run dev', () => {
    const file = path.join(__dirname, '..', '..', '..', 'docker', 'Dockerfile.dev');
    const content = fs.readFileSync(file, 'utf8');

    expect(content).toContain('npm ci --prefer-offline');
    expect(content).toContain('CMD ["npm", "run", "dev"]');
    expect(content).toContain('NEXT_TELEMETRY_DISABLED=1');
  });
});