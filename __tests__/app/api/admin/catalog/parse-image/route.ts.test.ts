import fs from 'fs';
import path from 'path';

test('file exists: app/api/admin/catalog/parse-image/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/admin/catalog/parse-image/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
