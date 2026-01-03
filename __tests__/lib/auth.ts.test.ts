import fs from 'fs';
import path from 'path';

test('file exists: lib/auth.ts', () => {
  const p = path.join(process.cwd(), 'lib/auth.ts');
  expect(fs.existsSync(p)).toBe(true);
});
