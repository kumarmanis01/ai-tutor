import fs from 'fs';
import path from 'path';

test('file exists: lib/content/approval/guard.ts', () => {
  const p = path.join(process.cwd(), 'lib/content/approval/guard.ts');
  expect(fs.existsSync(p)).toBe(true);
});
