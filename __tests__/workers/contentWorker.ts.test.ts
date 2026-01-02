import fs from 'fs';
import path from 'path';

test('file exists: workers/contentWorker.ts', () => {
  const p = path.join(process.cwd(), 'workers/contentWorker.ts');
  expect(fs.existsSync(p)).toBe(true);
});
