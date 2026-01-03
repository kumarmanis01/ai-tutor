import fs from 'fs';
import path from 'path';

test('file exists: lib/resolveAcademicIds.ts', () => {
  const p = path.join(process.cwd(), 'lib/resolveAcademicIds.ts');
  expect(fs.existsSync(p)).toBe(true);
});
