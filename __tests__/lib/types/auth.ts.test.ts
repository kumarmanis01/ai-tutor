import fs from 'fs';
import path from 'path';

test('file exists: lib/types/auth.ts', () => {
  const p = path.join(process.cwd(), 'lib/types/auth.ts');
  expect(fs.existsSync(p)).toBe(true);
});
