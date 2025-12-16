const fs = require('fs');
const path = require('path');
const { spawnSync, execSync } = require('child_process');

const logger = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};
logger.info('Running ESLint custom rule CLI tests...');

const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

// create a temporary flat config that loads our plugin implementation
const configPath = path.join(tmpDir, 'tmp_eslintrc.cjs');
fs.writeFileSync(configPath, `module.exports = {
  plugins: { 'ai-arch': require('../../index.cjs') },
  rules: {
    'ai-arch/no-llm-outside-callLLM': 'error'
  }
}`);

// fixtures
const fixtures = path.join(tmpDir, 'fixtures');
if (!fs.existsSync(fixtures)) fs.mkdirSync(fixtures);
fs.writeFileSync(path.join(fixtures, 'valid.js'), "// AI CONTENT ENGINE NOTICE\nimport callLLM from '../../lib/callLLM'\n")
fs.writeFileSync(path.join(fixtures, 'invalid.js'), "import OpenAI from 'openai'\n")

// Run eslint CLI against valid fixture (should pass)
const eslintBin = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'eslint.cmd' : 'eslint');
if (!fs.existsSync(eslintBin)) {
  logger.error('Local eslint binary not found at ' + eslintBin);
  process.exit(1);
}

const validFile = path.join(fixtures, 'valid.js');
try {
  const cmd = `"${eslintBin}" --config "${configPath}" "${validFile}" --ext .js,.ts,.tsx`;
  const out = execSync(cmd, { encoding: 'utf8' });
  if (out) logger.info(out);
} catch (err) {
  logger.error('ESLint rule CLI tests failed: valid fixture reported errors');
  if (err.stdout) logger.info(err.stdout.toString());
  if (err.stderr) logger.error(err.stderr.toString());
  process.exit(err.status || 1);
}

// Run eslint CLI against invalid fixture (should report errors)
const invalidFile = path.join(fixtures, 'invalid.js');
try {
  const cmd2 = `"${eslintBin}" --config "${configPath}" "${invalidFile}" --ext .js,.ts,.tsx`;
  execSync(cmd2, { encoding: 'utf8' });
  logger.error('ESLint rule CLI tests failed: invalid fixture did not report errors');
  process.exit(1);
} catch (err) {
  // Expected: eslint should exit non-zero on the invalid file
  if (err.stdout) logger.info(err.stdout.toString());
  if (err.stderr) logger.error(err.stderr.toString());
}

logger.info('ESLint rule CLI tests passed');
process.exit(0);
