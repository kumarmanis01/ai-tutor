import fs from 'fs';
import path from 'path';

test('file exists: workers/regenerationWorker.ts', () => {
  const p = path.join(process.cwd(), 'workers/regenerationWorker.ts');
  expect(fs.existsSync(p)).toBe(true);
});
