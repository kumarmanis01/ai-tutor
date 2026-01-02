import fs from 'fs';
import path from 'path';

test('file exists: lib/systemSettings.ts', () => {
  const p = path.join(process.cwd(), 'lib/systemSettings.ts');
  expect(fs.existsSync(p)).toBe(true);
});
