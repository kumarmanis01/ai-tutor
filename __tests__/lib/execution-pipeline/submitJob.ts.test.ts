import fs from 'fs';
import path from 'path';

test('file exists: lib/execution-pipeline/submitJob.ts', () => {
  const p = path.join(process.cwd(), 'lib/execution-pipeline/submitJob.ts');
  expect(fs.existsSync(p)).toBe(true);
});
