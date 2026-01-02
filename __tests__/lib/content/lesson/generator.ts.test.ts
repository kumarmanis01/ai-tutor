import fs from 'fs';
import path from 'path';

test('file exists: lib/content/lesson/generator.ts', () => {
  const p = path.join(process.cwd(), 'lib/content/lesson/generator.ts');
  expect(fs.existsSync(p)).toBe(true);
});
