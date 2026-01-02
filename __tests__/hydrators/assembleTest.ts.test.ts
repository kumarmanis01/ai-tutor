import fs from 'fs';
import path from 'path';

test('file exists: hydrators/assembleTest.ts', () => {
  const p = path.join(process.cwd(), 'hydrators/assembleTest.ts');
  expect(fs.existsSync(p)).toBe(true);
});
