import fs from 'fs';
import path from 'path';

test('file exists: lib/redis.ts', () => {
  const p = path.join(process.cwd(), 'lib/redis.ts');
  expect(fs.existsSync(p)).toBe(true);
});
