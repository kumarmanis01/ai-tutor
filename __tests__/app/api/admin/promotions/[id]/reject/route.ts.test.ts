import fs from 'fs';
import path from 'path';

test('file exists: app/api/admin/promotions/[id]/reject/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/admin/promotions/[id]/reject/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
