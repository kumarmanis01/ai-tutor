import fs from 'fs';
import path from 'path';

test('file exists: types/shims-sanscript.d.ts', () => {
  const p = path.join(process.cwd(), 'types/shims-sanscript.d.ts');
  expect(fs.existsSync(p)).toBe(true);
});
