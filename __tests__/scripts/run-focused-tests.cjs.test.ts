import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const runner = require('../../scripts/run-focused-tests.cjs');

test('file exists: scripts/run-focused-tests.cjs', () => {
  const p = path.join(process.cwd(), 'scripts/run-focused-tests.cjs');
  expect(fs.existsSync(p)).toBe(true);
});

test('parseCli reads suite and passthrough args', () => {
  const parsed = runner.parseCli(['--suite', 'proactive', '--', '--color']);
  expect(parsed.suite).toBe('proactive');
  expect(parsed.files).toEqual([]);
  expect(parsed.jestArgs).toEqual(['--color']);
});

test('resolveFiles returns proactive preset', () => {
  const files = runner.resolveFiles({ suite: 'proactive', files: [], jestArgs: [] });
  expect(files).toContain('tests/unit/app/api/admin/tests/[id]/reject.spec.ts');
  expect(files).toContain('tests/unit/lib/session/getPhaseContent.spec.ts');
});
