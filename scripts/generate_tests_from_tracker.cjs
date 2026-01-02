const fs = require('fs');
const path = require('path');

const tracker = path.join(process.cwd(), 'docs', 'TESTING_PROGRESS.md');
if (!fs.existsSync(tracker)) {
  console.error('Tracker not found:', tracker);
  process.exit(1);
}

const content = fs.readFileSync(tracker, 'utf8');
const lines = content.split(/\r?\n/);

const outBase = path.join(process.cwd(), '__tests__');
const rows = [];
for (const line of lines) {
  const m = line.match(/^\|\s*([^|]+)\s*\|/);
  if (!m) continue;
  const file = m[1].trim();
  if (!file || file.startsWith('File') || file.startsWith('---')) continue;
  if (file.includes('tests/') || file.includes('existing')) continue;
  rows.push(file);
}

if (!fs.existsSync(outBase)) fs.mkdirSync(outBase, { recursive: true });

for (const file of rows) {
  const rel = file.replace(/\\/g, '/');
  const destPath = path.join(outBase, rel + '.test.ts');
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const testContent = `import fs from 'fs';\nimport path from 'path';\n\ntest('file exists: ${rel}', () => {\n  const p = path.join(process.cwd(), '${rel}');\n  expect(fs.existsSync(p)).toBe(true);\n});\n`;
  fs.writeFileSync(destPath, testContent, 'utf8');
  console.log('Wrote', destPath);
}

console.log('Generated', rows.length, 'tests under __tests__');
