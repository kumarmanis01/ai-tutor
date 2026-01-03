import fs from 'fs';
import path from 'path';

test('file exists: regeneration/executor.ts', () => {
  const p = path.join(process.cwd(), 'regeneration/executor.ts');
  expect(fs.existsSync(p)).toBe(true);
});
