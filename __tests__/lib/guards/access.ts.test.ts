import fs from 'fs';
import path from 'path';

test('file exists: lib/guards/access.ts', () => {
  const p = path.join(process.cwd(), 'lib/guards/access.ts');
  expect(fs.existsSync(p)).toBe(true);
});
