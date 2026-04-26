/**
 * FILE OBJECTIVE:
 * - Verify package.json keeps the default development scripts on Webpack while leaving Turbopack opt-in.
 *
 * LINKED UNIT TEST:
 * - tests/unit/package-json-dev-scripts.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T00:00:00Z | copilot | add regression coverage for the default Webpack dev scripts
 */

import fs from 'fs';
import path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

describe('package.json dev scripts', () => {
  it('defaults local development to webpack and keeps turbopack explicit', () => {
    const file = path.join(__dirname, '..', '..', 'package.json');
    const content = fs.readFileSync(file, 'utf8');
    const packageJson = JSON.parse(content) as PackageJson;

    expect(packageJson.scripts?.dev).toBe('next dev --webpack');
    expect(packageJson.scripts?.['dev:next']).toContain('next dev --webpack');
    expect(packageJson.scripts?.['dev:fast']).toBe('next dev --webpack');
    expect(packageJson.scripts?.['dev:turbopack']).toBe('next dev');
  });
});
