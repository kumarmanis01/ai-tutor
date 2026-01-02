import fs from 'fs';
import path from 'path';

test('file exists: lib/alerts/rateLimiter.ts', () => {
  const p = path.join(process.cwd(), 'lib/alerts/rateLimiter.ts');
  expect(fs.existsSync(p)).toBe(true);
});
