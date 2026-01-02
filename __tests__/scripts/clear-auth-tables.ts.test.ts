import fs from 'fs';
import path from 'path';

test('file exists: scripts/clear-auth-tables.ts', () => {
  const p = path.join(process.cwd(), 'scripts/clear-auth-tables.ts');
  expect(fs.existsSync(p)).toBe(true);
});
