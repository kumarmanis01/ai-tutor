import fs from 'fs';
import path from 'path';

test('file exists: lib/inputHandlers.ts', () => {
  const p = path.join(process.cwd(), 'lib/inputHandlers.ts');
  expect(fs.existsSync(p)).toBe(true);
});
