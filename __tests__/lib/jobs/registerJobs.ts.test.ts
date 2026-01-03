import fs from 'fs';
import path from 'path';

test('file exists: lib/jobs/registerJobs.ts', () => {
  const p = path.join(process.cwd(), 'lib/jobs/registerJobs.ts');
  expect(fs.existsSync(p)).toBe(true);
});
