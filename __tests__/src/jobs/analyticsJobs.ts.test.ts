import fs from 'fs';
import path from 'path';

test('file exists: src/jobs/analyticsJobs.ts', () => {
  const p = path.join(process.cwd(), 'src/jobs/analyticsJobs.ts');
  expect(fs.existsSync(p)).toBe(true);
});
