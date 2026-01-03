import fs from 'fs';
import path from 'path';

test('file exists: lib/resizeImage.ts', () => {
  const p = path.join(process.cwd(), 'lib/resizeImage.ts');
  expect(fs.existsSync(p)).toBe(true);
});
