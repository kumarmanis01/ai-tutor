import fs from 'fs';
import path from 'path';

test('file exists: app/api/admin/audit-logs/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/admin/audit-logs/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
