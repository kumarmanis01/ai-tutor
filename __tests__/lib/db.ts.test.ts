import fs from 'fs';
import path from 'path';

test('file exists: lib/db.ts', () => {
  const p = path.join(process.cwd(), 'lib/db.ts');
  expect(fs.existsSync(p)).toBe(true);
});
