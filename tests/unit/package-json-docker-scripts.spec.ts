/**
 * FILE OBJECTIVE:
 * - Verify package.json exposes the rebuilt Docker helper scripts.
 *
 * LINKED UNIT TEST:
 * - tests/unit/package-json-docker-scripts.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T00:00:00Z | copilot | add regression coverage for Docker package scripts
 */

import fs from 'fs';
import path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

describe('package.json Docker scripts', () => {
  it('points Docker helpers at docker compose', () => {
    const file = path.join(__dirname, '..', '..', 'package.json');
    const content = fs.readFileSync(file, 'utf8');
    const packageJson = JSON.parse(content) as PackageJson;

    expect(packageJson.scripts?.['docker:build']).toBe('docker compose build');
    expect(packageJson.scripts?.['docker:up']).toBe('docker compose up --build');
    expect(packageJson.scripts?.['docker:down']).toBe('docker compose down --remove-orphans');
    expect(packageJson.scripts?.['migrate:docker']).toContain('docker compose run --rm web');
  });
});