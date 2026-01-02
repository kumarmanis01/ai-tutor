import fs from 'fs';
import path from 'path';

test('file exists: src/app/api/admin/suggestions/[id]/accept/route.ts', () => {
  const p = path.join(process.cwd(), 'src/app/api/admin/suggestions/[id]/accept/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
