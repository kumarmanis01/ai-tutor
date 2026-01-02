import fs from 'fs';
import path from 'path';

test('file exists: types/accept-language-parser.d.ts', () => {
  const p = path.join(process.cwd(), 'types/accept-language-parser.d.ts');
  expect(fs.existsSync(p)).toBe(true);
});
