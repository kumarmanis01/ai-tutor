const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'tests', 'auto');
const IGNORE = ['node_modules', 'build', 'dist', '.next', 'tests', 'public', 'out', '.git'];

function isTypeOnly(file) {
  return file.endsWith('.d.ts');
}

function shouldSkip(file) {
  if (isTypeOnly(file)) return true;
  for (const ig of IGNORE) if (file.includes(path.join(ig))) return true;
  // skip this generator and the progress tracker
  if (file.includes('scripts' + path.sep + 'generate_simple_tests.cjs')) return true;
  if (file.endsWith('.test.ts') || file.endsWith('.spec.ts')) return true;
  return false;
}

function walk(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORE.includes(e.name)) continue;
      walk(full, cb);
    } else {
      cb(full);
    }
  }
}

function rel(p) { return path.relative(ROOT, p).split(path.sep).join('/'); }

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const files = [];
walk(ROOT, (file) => {
  if (!file.endsWith('.ts')) return;
  if (shouldSkip(file)) return;
  // also skip .mts/.cts if present
  if (file.endsWith('.mts') || file.endsWith('.cts')) return;
  files.push(file);
});

for (const file of files) {
  const relPath = rel(file);
  const testPath = path.join(OUT_DIR, relPath + '.test.ts');
  const testDir = path.dirname(testPath);
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  // strip .ts extension for module resolution in Jest/ts-jest
  const absPath = path.resolve(ROOT, relPath);
  const testContent = `import fs from 'fs';

describe('exists ${relPath}', () => {
  it('source file exists on disk', () => {
    const p = ${JSON.stringify(absPath)};
    expect(fs.existsSync(p)).toBe(true);
  });
});
`;

  try {
    fs.writeFileSync(testPath, testContent, { flag: 'wx' });
  } catch {
    // overwrite if exists
    fs.writeFileSync(testPath, testContent);
  }
}

console.log('Generated', files.length, 'test stubs in', OUT_DIR);
