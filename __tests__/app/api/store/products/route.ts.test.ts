import fs from 'fs';
import path from 'path';

test('file exists: app/api/store/products/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/store/products/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
