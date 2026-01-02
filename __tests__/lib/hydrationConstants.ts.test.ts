import fs from 'fs';
import path from 'path';

test('file exists: lib/hydrationConstants.ts', () => {
  const p = path.join(process.cwd(), 'lib/hydrationConstants.ts');
  expect(fs.existsSync(p)).toBe(true);
});
