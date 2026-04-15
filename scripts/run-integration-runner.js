#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const logDir = path.join(root, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, `integration-runner-${Date.now()}.log`);

const tests = [
  'tests/integration/scripts/ingest-curriculum.integration.test.ts',
  'tests/integration/payment_methods.integration.test.ts',
  'tests/integration/parent_subscription.integration.test.ts',
  'tests/integration/parent/progress.test.ts',
  'tests/integration/order_invoice.integration.test.ts',
  'tests/integration/infra/doubtkb_ivfflat.integration.test.ts',
  'tests/integration/hydrationFlow.test.ts',
  'tests/integration/hydrateAll-validation.test.ts',
  'tests/integration/hydrateAll-e2e.test.ts',
  'tests/integration/homeEngine.scenarios.withSeed.test.ts',
  'tests/integration/cost/reporting.test.ts',
  'tests/integration/analytics_job_suggestions.integration.test.ts',
  'tests/integration/alert-evaluator.test.ts',
  'tests/integration/ai/orchestrator.test.ts',
  'tests/integration/admin/audit_immutability.test.ts',
  'tests/integration/admin/audit.test.ts',
  'tests/integration/student/onboarding.test.ts',
  'tests/integration/student/session.test.ts',
  'tests/integration/submitSyllabus.integration.test.ts',
  'tests/integration/worker/runInactivityAlerts.integration.test.ts',
  'tests/integration/worker/suppressionSemantics.integration.test.ts',
  'tests/integration/worker/readinessDrop.integration.test.ts',
];

const write = (s) => {
  fs.appendFileSync(logFile, s + '\n', 'utf8');
};

write('Integration runner starting: ' + new Date().toISOString());
let failures = [];
for (const t of tests) {
  write('\n=== RUNNING: ' + t + ' ===');
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['jest', '--config', 'jest.integration.config.cjs', '--runInBand', '--detectOpenHandles', '--runTestsByPath', t];
  const res = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  write(res.stdout || '');
  write(res.stderr || '');
  write('EXIT CODE: ' + res.status);
  if (res.status !== 0) {
    failures.push({ test: t, code: res.status });
  }
}
write('\n=== SUMMARY ===');
if (failures.length === 0) {
  write('ALL PASSED');
  console.log('ALL PASSED -- log:', logFile);
  process.exit(0);
} else {
  write('FAILED FILES:');
  for (const f of failures) write(JSON.stringify(f));
  console.log('FAILED -- see log:', logFile);
  process.exit(1);
}
