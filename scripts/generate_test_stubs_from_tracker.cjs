/*
 * Script: generate_test_stubs_from_tracker.cjs
 * Purpose: Read docs/TESTING_PROGRESS.md and create minimal test stubs
 * for each file marked as STEP1/STEP2 (i.e., not started or pending),
 * placing them under __tests__/<mirrored_path>/<filename>.test.ts
 * and update the tracker to set Status -> in-progress for those files.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const trackerPath = path.join(repoRoot, 'docs', 'TESTING_PROGRESS.md');
const testsRoot = path.join(repoRoot, '__tests__');

function readTracker() {
  return fs.readFileSync(trackerPath, 'utf8');
}

function writeTracker(content) {
  fs.writeFileSync(trackerPath, content, 'utf8');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeTestStubFor(filePath) {
  const rel = filePath.replace(/\\/g, '/');
  const parts = rel.split('/');
  const filename = parts.pop();
  const testDir = path.join(testsRoot, ...parts);
  ensureDir(testDir);
  const testFile = path.join(testDir, `${filename}.test.ts`);
  if (fs.existsSync(testFile)) return false;
  const content = `/* AUTO-GENERATED TEST STUB */\nimport path from 'path'\n\ndescribe('${rel}', () => {\n  test('exports loadable', () => {\n    const p = path.join(process.cwd(), '${rel}');\n    // Import safely using require to avoid ESM resolution issues in tests\n    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require\n    const mod = require(p);\n    expect(mod).toBeDefined();\n  });\n});\n`;
  fs.writeFileSync(testFile, content, 'utf8');
  return true;
}

function run() {
  const md = readTracker();
  const lines = md.split('\n');
  const updatedLines = [];
  let changed = false;

  const rowRegex = /^\|\s*([^|]+)\s*\|\s*([0-9]+)\s*\|\s*([^|]+)\s*\|\s*(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(rowRegex);
    if (m) {
      const file = m[1].trim();
      const priority = m[2].trim();
      const status = m[3].trim();
      const notes = m[4] || '';
      if (status.toLowerCase().includes('not-started') || status.toLowerCase().includes('pending') || status.toLowerCase().includes('step1')) {
        const created = makeTestStubFor(file);
        const newStatus = 'in-progress';
        const newNotes = (notes.includes('AUTOGEN-STUB') ? notes : `${notes} AUTOGEN-STUB`);
        const newLine = `| ${file} | ${priority} | ${newStatus} | ${newNotes} `;
        updatedLines.push(newLine);
        changed = changed || created;
      } else {
        updatedLines.push(line);
      }
    } else {
      updatedLines.push(line);
    }
  }

  if (changed) {
    writeTracker(updatedLines.join('\n'));
    console.log('Generated stubs and updated tracker.');
  } else {
    console.log('No stubs created (no eligible rows or files already have tests).');
  }
}

run();
