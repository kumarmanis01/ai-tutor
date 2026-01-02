import fs from 'fs';
import path from 'path';

test('file exists: lib/alerts/redisRateLimiter.ts', () => {
  const p = path.join(process.cwd(), 'lib/alerts/redisRateLimiter.ts');
  expect(fs.existsSync(p)).toBe(true);
});
