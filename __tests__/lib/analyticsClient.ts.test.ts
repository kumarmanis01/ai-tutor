import fs from 'fs';
import path from 'path';

test('file exists: lib/analyticsClient.ts', () => {
  const p = path.join(process.cwd(), 'lib/analyticsClient.ts');
  expect(fs.existsSync(p)).toBe(true);
});
