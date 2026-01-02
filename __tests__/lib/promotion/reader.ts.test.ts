import fs from 'fs';
import path from 'path';

test('file exists: lib/promotion/reader.ts', () => {
  const p = path.join(process.cwd(), 'lib/promotion/reader.ts');
  expect(fs.existsSync(p)).toBe(true);
});
