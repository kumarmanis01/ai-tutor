import fs from 'fs';
import path from 'path';

test('file exists: worker/loop.ts', () => {
  const p = path.join(process.cwd(), 'worker/loop.ts');
  expect(fs.existsSync(p)).toBe(true);
});
