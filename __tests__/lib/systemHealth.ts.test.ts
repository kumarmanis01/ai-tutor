import fs from 'fs';
import path from 'path';

test('file exists: lib/systemHealth.ts', () => {
  const p = path.join(process.cwd(), 'lib/systemHealth.ts');
  expect(fs.existsSync(p)).toBe(true);
});
