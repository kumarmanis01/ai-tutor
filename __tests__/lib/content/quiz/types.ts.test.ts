import fs from 'fs';
import path from 'path';

test('file exists: lib/content/quiz/types.ts', () => {
  const p = path.join(process.cwd(), 'lib/content/quiz/types.ts');
  expect(fs.existsSync(p)).toBe(true);
});
