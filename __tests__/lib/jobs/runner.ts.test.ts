import fs from 'fs';
import path from 'path';

test('file exists: lib/jobs/runner.ts', () => {
  const p = path.join(process.cwd(), 'lib/jobs/runner.ts');
  expect(fs.existsSync(p)).toBe(true);
});
