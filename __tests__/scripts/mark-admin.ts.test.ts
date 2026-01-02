import fs from 'fs';
import path from 'path';

test('file exists: scripts/mark-admin.ts', () => {
  const p = path.join(process.cwd(), 'scripts/mark-admin.ts');
  expect(fs.existsSync(p)).toBe(true);
});
