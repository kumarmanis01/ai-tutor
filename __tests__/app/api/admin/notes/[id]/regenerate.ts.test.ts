import fs from 'fs';
import path from 'path';

test('file exists: app/api/admin/notes/[id]/regenerate.ts', () => {
  const p = path.join(process.cwd(), 'app/api/admin/notes/[id]/regenerate.ts');
  expect(fs.existsSync(p)).toBe(true);
});
