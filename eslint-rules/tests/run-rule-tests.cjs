// ESLint rule tests runner (Windows-safe)
let logger;
try {
  logger = require('../../lib/logger');
} catch (_err) {
  // When running under Node for lightweight tests, the TypeScript `lib/logger.ts`
  // may not be compiled to JS. Provide a minimal console-based fallback so the
  // rule tests can run in isolation on developer machines.
  logger = {
    error: (m) => console.error(m),
    info: (m) => console.log(m),
  };
}
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
  logger.error('Local eslint binary not found at ' + eslintBin);
  process.exit(1);
}

let failed = 0;
for (const t of tests) {
  try {
    const cmd = `"${eslintBin}" --config "${configPath}" "${t.file}"`;
    execSync(cmd, { encoding: 'utf8', stdio: 'inherit' });
    if (!t.shouldPass) {
      logger.error(`Test failed: ${t.file} should have reported errors but passed.`);
      failed++;
    } else {
      logger.info(`OK (passed): ${t.file}`);
    }
  } catch (err) {
    // eslint exits non-zero when it finds errors
    if (t.shouldPass) {
      logger.error(`Test failed: ${t.file} should have passed but reported errors.`);
      logger.error(err.stdout && err.stdout.toString());
      failed++;
    } else {
      logger.info(`OK (errored as expected): ${t.file}`);
    }
  }
}

if (failed > 0) {
  logger.error(`Tests failed: ${failed}`);
  process.exit(2);
} else {
  logger.info('All ESLint rule CLI tests passed.');
  process.exit(0);
}

