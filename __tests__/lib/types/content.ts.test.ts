import fs from 'fs';
import path from 'path';

test('file exists: lib/types/content.ts', () => {
  const p = path.join(process.cwd(), 'lib/types/content.ts');
  expect(fs.existsSync(p)).toBe(true);
});
