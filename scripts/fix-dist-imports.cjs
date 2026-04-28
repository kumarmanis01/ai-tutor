#!/usr/bin/env node
/**
 * FILE OBJECTIVE:
 * - Rewrite emitted dist JS relative imports to explicit ESM file specifiers (.js or /index.js).
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/fix-dist-imports.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T00:00:00Z | copilot | improve import rewrite matcher for deterministic ESM extension patching
 */
const fs = require('fs');
const path = require('path');

// By default operate only on the worker output to avoid touching Next runtime files.
// To operate on the top-level `dist` explicitly pass the root as the first arg
// AND provide the `--force` flag to acknowledge the risk.
const userRoot = process.argv[2];
const FORCE = process.argv.includes('--force');
const DEFAULT_ROOT = path.join(process.cwd(), 'dist', 'worker');
let ROOT = userRoot || DEFAULT_ROOT;
ROOT = path.resolve(ROOT);

const topLevelDist = path.resolve(path.join(process.cwd(), 'dist'));
if (!userRoot) {
  // default to worker output
  if (!fs.existsSync(ROOT)) {
    console.error(
      'worker dist not found at',
      ROOT,
      '\nRun a workers build first or pass an explicit root.'
    );
    process.exit(1);
  }
} else {
  // user provided a root; disallow operating on top-level dist unless --force
  if (ROOT === topLevelDist && !FORCE) {
    console.error(
      '\nRefusing to run on top-level dist. This script can modify Next/React server files and cause runtime issues.'
    );
    console.error('If you really want to run on the top-level dist, re-run with:');
    console.error('  node scripts/fix-dist-imports.cjs dist --force\n');
    process.exit(1);
  }
}

function walk(dir, cb) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p, cb);
    else if (s.isFile() && p.endsWith('.js')) cb(p);
  }
}

const staticImportRe = /(from\s+['"])(\.\.?\/[^'"\n]+)(['"])/g;
const dynamicImportRe = /(import\s*\(\s*['"])(\.\.?\/[^'"\n]+)(['"]\s*\))/g;

function normalizeSpecifier(file, imp, existsFn) {
  if (imp.endsWith('.js') || imp.endsWith('.mjs') || imp.endsWith('.cjs')) return imp;

  const fileDir = path.dirname(file);
  const candidateFile = path.resolve(fileDir, imp + '.js');
  const candidateIndex = path.resolve(fileDir, imp, 'index.js');

  if (existsFn(candidateFile)) return imp + '.js';
  if (existsFn(candidateIndex)) return imp + '/index.js';

  return imp + '.js';
}

function rewriteRelativeImportSpecifiers(source, file, existsFn) {
  const withStatic = source.replace(staticImportRe, (m, prefix, imp, suffix) => {
    return `${prefix}${normalizeSpecifier(file, imp, existsFn)}${suffix}`;
  });

  return withStatic.replace(dynamicImportRe, (m, prefix, imp, suffix) => {
    return `${prefix}${normalizeSpecifier(file, imp, existsFn)}${suffix}`;
  });
}

function run() {
  let patched = 0;
  walk(ROOT, (file) => {
    try {
      let src = fs.readFileSync(file, 'utf8');
      const out = rewriteRelativeImportSpecifiers(src, file, fs.existsSync);
      if (out !== src) {
        fs.writeFileSync(file, out, 'utf8');
        patched++;
        console.log('patched', file);
      }
    } catch (e) {
      console.error('err', file, e && e.message);
    }
  });
  console.log('done. patched files:', patched);
}

if (require.main === module) {
  run();
}

module.exports = {
  normalizeSpecifier,
  rewriteRelativeImportSpecifiers,
  run,
};
