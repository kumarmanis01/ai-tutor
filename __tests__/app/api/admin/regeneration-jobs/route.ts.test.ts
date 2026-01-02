import fs from 'fs';
import path from 'path';

test('file exists: app/api/admin/regeneration-jobs/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/admin/regeneration-jobs/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
