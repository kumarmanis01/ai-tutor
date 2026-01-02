import fs from 'fs';
import path from 'path';

test('file exists: lib/metrics/jobs.ts', () => {
  const p = path.join(process.cwd(), 'lib/metrics/jobs.ts');
  expect(fs.existsSync(p)).toBe(true);
});
