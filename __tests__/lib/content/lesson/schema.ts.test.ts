import fs from 'fs';
import path from 'path';

test('file exists: lib/content/lesson/schema.ts', () => {
  const p = path.join(process.cwd(), 'lib/content/lesson/schema.ts');
  expect(fs.existsSync(p)).toBe(true);
});
