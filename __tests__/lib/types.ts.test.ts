import fs from 'fs';
import path from 'path';

test('file exists: lib/types.ts', () => {
  const p = path.join(process.cwd(), 'lib/types.ts');
  expect(fs.existsSync(p)).toBe(true);
});
