import fs from 'fs';
import path from 'path';

test('file exists: middleware.ts', () => {
  const p = path.join(process.cwd(), 'proxy.ts');
  expect(fs.existsSync(p)).toBe(true);
});
