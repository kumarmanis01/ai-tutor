import fs from 'fs';
import path from 'path';

test('file exists: lib/content/quiz/schema.ts', () => {
  const p = path.join(process.cwd(), 'lib/content/quiz/schema.ts');
  expect(fs.existsSync(p)).toBe(true);
});
