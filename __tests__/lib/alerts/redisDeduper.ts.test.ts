import fs from 'fs';
import path from 'path';

test('file exists: lib/alerts/redisDeduper.ts', () => {
  const p = path.join(process.cwd(), 'lib/alerts/redisDeduper.ts');
  expect(fs.existsSync(p)).toBe(true);
});
