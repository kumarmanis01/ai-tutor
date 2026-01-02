import fs from 'fs';
import path from 'path';

test('file exists: lib/watchdogs.ts', () => {
  const p = path.join(process.cwd(), 'lib/watchdogs.ts');
  expect(fs.existsSync(p)).toBe(true);
});
