import fs from 'fs';
import path from 'path';

test('file exists: lib/rateLimit.ts', () => {
  const p = path.join(process.cwd(), 'lib/rateLimit.ts');
  expect(fs.existsSync(p)).toBe(true);
});
