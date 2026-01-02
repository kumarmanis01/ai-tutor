import fs from 'fs';
import path from 'path';

test('file exists: lib/alerts/dedupe.ts', () => {
  const p = path.join(process.cwd(), 'lib/alerts/dedupe.ts');
  expect(fs.existsSync(p)).toBe(true);
});
