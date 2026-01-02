import fs from 'fs';
import path from 'path';

test('file exists: app/api/admin/topics/[id]/rollback/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/admin/topics/[id]/rollback/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
