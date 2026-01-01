/* eslint-disable */
const { spawn } = require('child_process');

// This integration test runs the evaluator script in dry-run, single-run mode.
// It requires DATABASE_URL to be set in the environment by CI; when absent
// the test will skip to avoid false failures in local dev.

if (!process.env.DATABASE_URL) {
  console.log('Skipping dry-run integration: DATABASE_URL not set');
  process.exit(0);
}

const env = Object.assign({}, process.env, {
  RUN_ONCE: '1',
  EVALUATOR_DRY_RUN: '1',
});

const nodeArgs = ['dist/scripts/runAlertEvaluator.js'];

const p = spawn(process.execPath, nodeArgs, { env });

let out = '';
let err = '';

p.stdout.on('data', (d) => { out += d.toString(); });
p.stderr.on('data', (d) => { err += d.toString(); });

p.on('close', (code) => {
  console.log('evaluator dry-run exited with', code);
  if (err) console.error(err);
  // Ensure the dry-run emitted at least one expected event
  if (!out.includes('evaluator_starting') && !out.includes('alert_dry_run') && !out.includes('alert_router_initialized') && !out.includes('run_complete')) {
    console.error('Evaluator dry-run did not emit expected logs:\n', out);
    process.exit(2);
  }
  process.exit(code === 0 ? 0 : 2);
});
