/**
 * FILE OBJECTIVE:
 * - Verify dist import specifier rewriting for ESM compatibility in production runtime.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T00:00:00Z | copilot | add tests for static/dynamic relative import rewriting
 * - 2026-04-26T00:00:00Z | copilot | normalize test path separators for cross-platform assertions
 */

const {
  normalizeSpecifier,
  rewriteRelativeImportSpecifiers,
} = require('../../../scripts/fix-dist-imports.cjs');

describe('fix-dist-imports', () => {
  it('should append .js for extensionless relative static imports when file exists', () => {
    const exists = (candidate: string): boolean => candidate.endsWith('lib/socket/server.js');

    const result = normalizeSpecifier(
      '/repo/dist/server.js',
      './lib/socket/server',
      exists
    );

    expect(result).toBe('./lib/socket/server.js');
  });

  it('should rewrite to /index.js when target is a directory module', () => {
    const exists = (candidate: string): boolean =>
      candidate.replace(/\\/g, '/').endsWith('lib/invoices/index.js');

    const result = normalizeSpecifier('/repo/dist/server.js', './lib/invoices', exists);

    expect(result).toBe('./lib/invoices/index.js');
  });

  it('should rewrite both static and dynamic relative imports', () => {
    const src = [
      "import { x } from './lib/socket/server';",
      "const mod = await import('./lib/auth/token.service');",
    ].join('\n');

    const exists = (_candidate: string): boolean => true;
    const out = rewriteRelativeImportSpecifiers(src, '/repo/dist/server.js', exists);

    expect(out).toContain("from './lib/socket/server.js'");
    expect(out).toContain("import('./lib/auth/token.service.js')");
  });
});
