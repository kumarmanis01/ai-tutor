import fs from 'fs';
import path from 'path';

test('file exists: lib/exporters/lms.ts', () => {
  const p = path.join(process.cwd(), 'lib/exporters/lms.ts');
  expect(fs.existsSync(p)).toBe(true);
});
