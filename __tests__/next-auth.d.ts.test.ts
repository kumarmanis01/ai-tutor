import fs from 'fs';
import path from 'path';

test('file exists: next-auth.d.ts', () => {
  const p = path.join(process.cwd(), 'next-auth.d.ts');
  expect(fs.existsSync(p)).toBe(true);
});
