import fs from 'fs';
import path from 'path';

test('file exists: lib/course/package/schema.ts', () => {
  const p = path.join(process.cwd(), 'lib/course/package/schema.ts');
  expect(fs.existsSync(p)).toBe(true);
});
