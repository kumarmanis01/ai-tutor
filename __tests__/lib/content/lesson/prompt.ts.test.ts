import fs from 'fs';
import path from 'path';

test('file exists: lib/content/lesson/prompt.ts', () => {
  const p = path.join(process.cwd(), 'lib/content/lesson/prompt.ts');
  expect(fs.existsSync(p)).toBe(true);
});
