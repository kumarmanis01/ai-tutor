import fs from 'fs';
import path from 'path';

test('file exists: declarations.d.ts', () => {
  const p = path.join(process.cwd(), 'declarations.d.ts');
  expect(fs.existsSync(p)).toBe(true);
});
