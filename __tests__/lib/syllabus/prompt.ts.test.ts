import fs from 'fs';
import path from 'path';

test('file exists: lib/syllabus/prompt.ts', () => {
  const p = path.join(process.cwd(), 'lib/syllabus/prompt.ts');
  expect(fs.existsSync(p)).toBe(true);
});
