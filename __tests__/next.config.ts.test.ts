import fs from 'fs';
import path from 'path';

test('file exists: next.config.ts', () => {
  const p = path.join(process.cwd(), 'next.config.ts');
  expect(fs.existsSync(p)).toBe(true);
});
