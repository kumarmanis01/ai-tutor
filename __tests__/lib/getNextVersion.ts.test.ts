import fs from 'fs';
import path from 'path';

test('file exists: lib/getNextVersion.ts', () => {
  const p = path.join(process.cwd(), 'lib/getNextVersion.ts');
  expect(fs.existsSync(p)).toBe(true);
});
