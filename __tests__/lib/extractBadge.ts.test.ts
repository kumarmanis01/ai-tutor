import fs from 'fs';
import path from 'path';

test('file exists: lib/extractBadge.ts', () => {
  const p = path.join(process.cwd(), 'lib/extractBadge.ts');
  expect(fs.existsSync(p)).toBe(true);
});
