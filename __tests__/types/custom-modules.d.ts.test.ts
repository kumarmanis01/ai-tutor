import fs from 'fs';
import path from 'path';

test('file exists: types/custom-modules.d.ts', () => {
  const p = path.join(process.cwd(), 'types/custom-modules.d.ts');
  expect(fs.existsSync(p)).toBe(true);
});
