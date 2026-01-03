import fs from 'fs';
import path from 'path';

test('file exists: lib/i18n.ts', () => {
  const p = path.join(process.cwd(), 'lib/i18n.ts');
  expect(fs.existsSync(p)).toBe(true);
});
