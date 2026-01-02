import fs from 'fs';
import path from 'path';

test('file exists: lib/content/quiz/prompt.ts', () => {
  const p = path.join(process.cwd(), 'lib/content/quiz/prompt.ts');
  expect(fs.existsSync(p)).toBe(true);
});
