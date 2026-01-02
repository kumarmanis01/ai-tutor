import fs from 'fs';
import path from 'path';

test('file exists: types/prisma-shim.d.ts', () => {
  const p = path.join(process.cwd(), 'types/prisma-shim.d.ts');
  expect(fs.existsSync(p)).toBe(true);
});
