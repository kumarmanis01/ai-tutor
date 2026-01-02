import fs from 'fs';
import path from 'path';

test('file exists: app/api/admin/notes/[id]/reject.ts', () => {
  const p = path.join(process.cwd(), 'app/api/admin/notes/[id]/reject.ts');
  expect(fs.existsSync(p)).toBe(true);
});
