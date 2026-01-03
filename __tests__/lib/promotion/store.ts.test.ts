import fs from 'fs';
import path from 'path';

test('file exists: lib/promotion/store.ts', () => {
  const p = path.join(process.cwd(), 'lib/promotion/store.ts');
  expect(fs.existsSync(p)).toBe(true);
});
