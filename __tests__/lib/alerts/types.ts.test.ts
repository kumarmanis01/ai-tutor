import fs from 'fs';
import path from 'path';

test('file exists: lib/alerts/types.ts', () => {
  const p = path.join(process.cwd(), 'lib/alerts/types.ts');
  expect(fs.existsSync(p)).toBe(true);
});
