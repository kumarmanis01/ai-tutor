import fs from 'fs';
import path from 'path';

test('file exists: lib/alerts/metrics.ts', () => {
  const p = path.join(process.cwd(), 'lib/alerts/metrics.ts');
  expect(fs.existsSync(p)).toBe(true);
});
