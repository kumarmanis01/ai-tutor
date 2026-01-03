import fs from 'fs';
import path from 'path';

test('file exists: lib/course/package/builder.ts', () => {
  const p = path.join(process.cwd(), 'lib/course/package/builder.ts');
  expect(fs.existsSync(p)).toBe(true);
});
