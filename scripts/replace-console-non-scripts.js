#!/usr/bin/env node
// Codemod: Replace console.* with structured `logger` in all files excluding scripts/ and node_modules
// Usage: node scripts/replace-console-non-scripts.js [--dry-run]

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const exts = ['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx'];

function walk(dir) {
  const res = [];
  for (const f of fs.readdirSync(dir)) {
    if (f === 'node_modules' || f === 'scripts') continue; // skip scripts and node_modules
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) res.push(...walk(p));
    else if (exts.includes(path.extname(p))) res.push(p);
  }
  return res;
}

function computeRelPath(file) {
  const rel = path.relative(path.dirname(file), path.join(root, 'lib', 'logger'));
  let r = rel.split(path.sep).join('/');
  if (!r.startsWith('.')) r = './' + r;
  return r;
}

const files = walk(root);
const changes = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (!/console\.(log|warn|error)\s*\(/.test(content)) continue;
  // skip any file under scripts (redundant) or node_modules (already filtered)
  const relPath = computeRelPath(file);
  const usesImportExport = /(^|\n)\s*(import .* from |export )/.test(content);
  const loggerImportESM = `import logger from '${relPath}';`;
  const loggerImportCJS = `const logger = require('${relPath}');`;
  let out = content;
  out = out.replace(/console\.log\s*\(/g, 'logger.info(');
  out = out.replace(/console\.warn\s*\(/g, 'logger.warn(');
  out = out.replace(/console\.error\s*\(/g, 'logger.error(');

  // insert import/require if not present
  if (
    !new RegExp('logger\s*=\s*require\\([\'"]' + relPath.replace(/\//g, '\\/') + '[\'"]\)').test(
      out
    ) &&
    !new RegExp('from\\s+[\'"]' + relPath.replace(/\//g, '\\/') + '[\'"]').test(out) &&
    !/\blogger\b/.test(content)
  ) {
    const firstLine = out.split('\n', 1)[0];
    if (usesImportExport) {
      out = loggerImportESM + '\n' + out;
    } else {
      out = loggerImportCJS + '\n' + out;
    }
  }

  changes.push({ file, before: content, after: out });
}

if (changes.length === 0) {
  console.log('No non-scripts console.* occurrences found to replace.');
  process.exit(0);
}

console.log(`Found ${changes.length} files to change (excluding scripts/ and node_modules).`);
for (const c of changes) console.log('  -', path.relative(root, c.file));

if (dryRun) {
  console.log('\nDry-run; no files were modified. Re-run without --dry-run to apply changes.');
  process.exit(0);
}

for (const c of changes) {
  fs.writeFileSync(c.file, c.after, 'utf8');
}
console.log('Applied changes to files.');
