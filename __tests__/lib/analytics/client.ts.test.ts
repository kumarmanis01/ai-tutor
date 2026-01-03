import fs from 'fs';
import path from 'path';

test('file exists: lib/analytics/client.ts', () => {
  const p = path.join(process.cwd(), 'lib/analytics/client.ts');
  expect(fs.existsSync(p)).toBe(true);
});
