#!/usr/bin/env node
/*
 * Simple codemod: replace `new Redis(...)` or `new IORedis(...)` with the shared
 * `getRedis()` helper from `lib/redis`.
 *
 * Safety:
 * - Dry-run by default (prints files that would be changed).
 * - Pass `--apply` to write changes.
 * - Skips `lib/redis.ts`, `lib/redis/client.ts`, `scripts/` and `tests/integration/`.
 *
 * Usage:
 *   node scripts/replace-new-redis.cjs        # dry-run
 *   node scripts/replace-new-redis.cjs --apply  # apply changes
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'coverage', 'vendor', 'eslint-rules',
  'scripts', 'tests/integration'
]);
const FILE_EXTS = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs', '.jsx']);

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (IGNORED_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (stat.isFile() && FILE_EXTS.has(path.extname(full))) processFile(full);
  }
}

function relImport(fromFile) {
  const rel = path.relative(path.dirname(fromFile), path.join(ROOT, 'lib', 'redis'))
    .split(path.sep)
    .join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

function alreadyHasGetRedisImport(text) {
  return /import\s+\{\s*getRedis\s*\}/.test(text) ||
    /require\(['"].*lib\/redis['"]\)/.test(text) ||
    /const\s+\{\s*getRedis\s*\}/.test(text) ||
    /getRedis\(/.test(text);
}

function shouldSkip(rel) {
  if (rel === 'lib/redis.ts' || rel === 'lib/redis/client.ts') return true;
  if (/^tests[\\\/]integration[\\\/]/.test(rel)) return true;
  return false;
}

function processFile(file) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (shouldSkip(rel)) return;

  let src = fs.readFileSync(file, 'utf8');
  if (!/new\s+(?:Redis|IORedis)\s*\(/.test(src)) return;

  let out = src;
  const libPath = relImport(file);

  // Insert getRedis import/require if not present
  if (!alreadyHasGetRedisImport(out)) {
    const shebangMatch = out.match(/^#!.*\n/);
    const insertPos = shebangMatch ? shebangMatch[0].length : 0;
    const ext = path.extname(file).toLowerCase();
    const importStmt = ext === '.cjs'
      ? `const { getRedis } = require('${libPath}');\n` 
      : `import { getRedis } from '${libPath}';\n`;
    out = out.slice(0, insertPos) + importStmt + out.slice(insertPos);
  }

  // Replace constructor calls with getRedis() call.
  // This is intentionally simple and conservative.
  out = out.replace(/new\s+(?:Redis|IORedis)\s*\([^)]*\)/g, 'getRedis()');

  if (out !== src) {
    if (APPLY) {
      fs.writeFileSync(file, out, 'utf8');
      console.log('Patched', file);
    } else {
      console.log('Would patch', file);
    }
  }
}

function main() {
  console.log('replace-new-redis codemod —', APPLY ? 'APPLYING' : 'dry-run');
  walk(ROOT);
  console.log('Done');
}

main();
