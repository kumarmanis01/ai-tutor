import fs from 'fs';
import path from 'path';

test('file exists: app/api/store/purchase/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/store/purchase/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
