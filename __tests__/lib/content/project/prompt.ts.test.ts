import fs from 'fs';
import path from 'path';

test('file exists: lib/content/project/prompt.ts', () => {
  const p = path.join(process.cwd(), 'lib/content/project/prompt.ts');
  expect(fs.existsSync(p)).toBe(true);
});
