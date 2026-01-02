import fs from 'fs';
import path from 'path';

test('file exists: lib/tutorStyles.ts', () => {
  const p = path.join(process.cwd(), 'lib/tutorStyles.ts');
  expect(fs.existsSync(p)).toBe(true);
});
