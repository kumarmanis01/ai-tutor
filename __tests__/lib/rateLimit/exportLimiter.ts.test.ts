import fs from 'fs';
import path from 'path';

test('file exists: lib/rateLimit/exportLimiter.ts', () => {
  const p = path.join(process.cwd(), 'lib/rateLimit/exportLimiter.ts');
  expect(fs.existsSync(p)).toBe(true);
});
