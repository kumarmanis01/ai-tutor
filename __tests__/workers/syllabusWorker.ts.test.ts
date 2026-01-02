import fs from 'fs';
import path from 'path';

test('file exists: workers/syllabusWorker.ts', () => {
  const p = path.join(process.cwd(), 'workers/syllabusWorker.ts');
  expect(fs.existsSync(p)).toBe(true);
});
