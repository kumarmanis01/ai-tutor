import fs from 'fs';
import path from 'path';

test('file exists: src/jobs/regenerationJobRunner.ts', () => {
  const p = path.join(process.cwd(), 'src/jobs/regenerationJobRunner.ts');
  expect(fs.existsSync(p)).toBe(true);
});
