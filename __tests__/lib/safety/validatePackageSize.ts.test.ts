import fs from 'fs';
import path from 'path';

test('file exists: lib/safety/validatePackageSize.ts', () => {
  const p = path.join(process.cwd(), 'lib/safety/validatePackageSize.ts');
  expect(fs.existsSync(p)).toBe(true);
});
