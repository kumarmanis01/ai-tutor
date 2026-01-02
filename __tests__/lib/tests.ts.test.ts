import fs from 'fs';
import path from 'path';

test('file exists: lib/tests.ts', () => {
  const p = path.join(process.cwd(), 'lib/tests.ts');
  expect(fs.existsSync(p)).toBe(true);
});
