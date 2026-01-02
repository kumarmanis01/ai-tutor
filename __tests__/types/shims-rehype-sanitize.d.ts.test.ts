import fs from 'fs';
import path from 'path';

test('file exists: types/shims-rehype-sanitize.d.ts', () => {
  const p = path.join(process.cwd(), 'types/shims-rehype-sanitize.d.ts');
  expect(fs.existsSync(p)).toBe(true);
});
