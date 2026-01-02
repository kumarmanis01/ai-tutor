import fs from 'fs';
import path from 'path';

test('file exists: queues/contentQueue.ts', () => {
  const p = path.join(process.cwd(), 'queues/contentQueue.ts');
  expect(fs.existsSync(p)).toBe(true);
});
