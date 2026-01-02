import fs from 'fs';
import path from 'path';

test('file exists: lib/prisma.ts', () => {
  const p = path.join(process.cwd(), 'lib/prisma.ts');
  expect(fs.existsSync(p)).toBe(true);
});
