import fs from 'fs';
import path from 'path';

test('file exists: lib/syllabus/types.ts', () => {
  const p = path.join(process.cwd(), 'lib/syllabus/types.ts');
  expect(fs.existsSync(p)).toBe(true);
});
