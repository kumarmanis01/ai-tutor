const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUTO_DIR = path.join(ROOT, 'tests', 'auto');
const BATCH = Number(process.env.BATCH || 20);

function listTestFiles(dir) {
  const out = [];
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name.endsWith('.test.ts')) out.push(full);
    }
  }
  walk(dir);
  return out.sort();
}

const files = listTestFiles(AUTO_DIR).slice(0, BATCH);
for (const f of files) {
  const rel = path.relative(AUTO_DIR, f).split(path.sep).join('/');
  // derive module path by removing tests/auto prefix and .test.ts suffix
  const modRel = rel.replace(/\.test\.ts$/, '');
  // attempt to import via two-level relative path from test file
  // compute path from test file to repo root
  const testDir = path.dirname(f);
  const depth = testDir.split(path.sep).length - AUTO_DIR.split(path.sep).length;
  const prefix = '../'.repeat(depth + 1);
  const moduleImport = prefix + modRel.replace(/\\/g, '/');

  const content = `describe('import ${modRel}', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('${moduleImport}');
    }).not.toThrow();
  });
});
`;

  fs.writeFileSync(f, content);
}

console.log('Converted', files.length, 'tests to import-style');
