import fs from 'fs';
import path from 'path';

test('file exists: lib/audit/log.ts', () => {
  const p = path.join(process.cwd(), 'lib/audit/log.ts');
  expect(fs.existsSync(p)).toBe(true);
});
