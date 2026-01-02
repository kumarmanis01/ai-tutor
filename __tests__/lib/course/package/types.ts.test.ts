import fs from 'fs';
import path from 'path';

test('file exists: lib/course/package/types.ts', () => {
  const p = path.join(process.cwd(), 'lib/course/package/types.ts');
  expect(fs.existsSync(p)).toBe(true);
});
