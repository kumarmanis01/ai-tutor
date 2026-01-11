#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

const configPath = path.join(tmpDir, 'tmp_eslintrc.cjs');
fs.writeFileSync(configPath, `module.exports = {
  plugins: { 'ai-guards': require('../../index.cjs') },
  rules: {
    'ai-guards/no-import-time-redis': 'error'
  }
}`);

const fixturesDir = path.join(__dirname, 'fixtures');
const tests = [
  { file: path.join(fixturesDir, 'valid.js'), shouldPass: true },
  { file: path.join(fixturesDir, 'invalid.js'), shouldPass: false },
];

const eslintBin = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'eslint.cmd' : 'eslint');
if (!fs.existsSync(eslintBin)) {
  console.error('Local eslint binary not found at ' + eslintBin);
  process.exit(1);
}

let failed = 0;
for (const t of tests) {
  try {
    const cmd = `"${eslintBin}" --config "${configPath}" "${t.file}"`;
    execSync(cmd, { encoding: 'utf8', stdio: 'inherit' });
    if (!t.shouldPass) {
      console.error(`Test failed: ${t.file} should have reported errors but passed.`);
      failed++;
    } else {
      console.log(`OK (passed): ${t.file}`);
    }
  } catch (err) {
    // eslint exits non-zero when it finds errors
    if (t.shouldPass) {
      console.error(`Test failed: ${t.file} should have passed but reported errors.`);
      console.error(err.stdout && err.stdout.toString());
      failed++;
    } else {
      console.log(`OK (errored as expected): ${t.file}`);
    }
  }
}

if (failed > 0) {
  console.error(`Tests failed: ${failed}`);
  process.exit(2);
} else {
  console.log('All ESLint rule CLI tests passed.');
  process.exit(0);
}

