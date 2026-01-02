import fs from 'fs';
import path from 'path';

test('file exists: types/next-shims.d.ts', () => {
  const p = path.join(process.cwd(), 'types/next-shims.d.ts');
  expect(fs.existsSync(p)).toBe(true);
});
