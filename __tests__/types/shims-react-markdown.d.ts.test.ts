import fs from 'fs';
import path from 'path';

test('file exists: types/shims-react-markdown.d.ts', () => {
  const p = path.join(process.cwd(), 'types/shims-react-markdown.d.ts');
  expect(fs.existsSync(p)).toBe(true);
});
