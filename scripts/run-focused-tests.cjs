/**
 * FILE OBJECTIVE:
 * - Run Jest through a shell-safe Node entrypoint for all test invocations in this repo, avoiding PowerShell path/quoting issues while supporting optional suite presets.
 *
 * LINKED UNIT TEST:
 * - __tests__/scripts/run-focused-tests.cjs.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | created focused jest runner with stable suite presets and argument parsing
 * - 2026-05-09T00:00:00Z | copilot | generalized runner to repo-wide Jest infra (all tests default) with optional preset suite support
 * - 2026-05-09T00:00:00Z | copilot | enforce --runTestsByPath for file-targeted runs so bracketed route test paths execute correctly
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_JEST_ARGS = [];

const SUITE_PRESETS = {
  proactive: [
    'tests/unit/worker/weeklyDigestWorker.test.ts',
    'tests/unit/worker/parentEmailDigestHtml.test.ts',
    'tests/unit/app/api/admin/tests/[id]/reject.spec.ts',
    'tests/unit/lib/session/getPhaseContent.spec.ts',
  ],
};

function parseCli(argv) {
  const parsed = {
    suite: null,
    files: [],
    jestArgs: [],
  };

  const args = Array.isArray(argv) ? argv.slice() : [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--suite') {
      parsed.suite = args[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg.startsWith('--suite=')) {
      parsed.suite = arg.slice('--suite='.length);
      continue;
    }
    if (arg === '--') {
      parsed.jestArgs = args.slice(i + 1);
      break;
    }
    if (arg.startsWith('-')) {
      parsed.jestArgs.push(arg);
      continue;
    }
    parsed.files.push(arg);
  }

  return parsed;
}

function resolveFiles(parsed) {
  if (parsed.files.length > 0) {
    return parsed.files;
  }
  if (parsed.suite) {
    const preset = SUITE_PRESETS[parsed.suite];
    if (!preset) {
      const names = Object.keys(SUITE_PRESETS).join(', ');
      throw new Error(`Unknown suite \"${parsed.suite}\". Available suites: ${names}`);
    }
    return preset;
  }
  return [];
}

function validateFiles(repoRoot, files) {
  const missing = [];
  for (const relFile of files) {
    const absPath = path.resolve(repoRoot, relFile);
    if (!fs.existsSync(absPath)) {
      missing.push(relFile);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing test files: ${missing.join(', ')}`);
  }
}

function runFocusedTests(argv) {
  const repoRoot = path.resolve(__dirname, '..');
  const parsed = parseCli(argv);
  const files = resolveFiles(parsed);
  const hasFileTargets = files.length > 0;
  if (hasFileTargets) {
    validateFiles(repoRoot, files);
  }

  const jestBin = path.resolve(repoRoot, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!fs.existsSync(jestBin)) {
    throw new Error('Jest binary not found at node_modules/jest/bin/jest.js. Run npm install first.');
  }

  const nodeExe = process.execPath || 'node';
  const args = hasFileTargets
    ? [jestBin, '--runTestsByPath', ...files, ...DEFAULT_JEST_ARGS, ...parsed.jestArgs]
    : [jestBin, ...DEFAULT_JEST_ARGS, ...parsed.jestArgs];

  const result = spawnSync(nodeExe, args, {
    stdio: 'inherit',
    cwd: repoRoot,
    env: process.env,
    shell: false,
  });

  return result.status ?? 1;
}

if (require.main === module) {
  try {
    const exitCode = runFocusedTests(process.argv.slice(2));
    process.exit(exitCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[run-focused-tests] ${message}`);
    process.exit(1);
  }
}

module.exports = {
  DEFAULT_JEST_ARGS,
  SUITE_PRESETS,
  parseCli,
  resolveFiles,
  runFocusedTests,
  validateFiles,
};
