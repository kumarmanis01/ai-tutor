import fs from 'fs';
import path from 'path';

test('file exists: jobs/installmentDunning.ts', () => {
  const p = path.join(process.cwd(), 'jobs/installmentDunning.ts');
  expect(fs.existsSync(p)).toBe(true);
});
