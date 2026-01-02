import fs from 'fs';
import path from 'path';

test('file exists: lib/session.ts', () => {
  const p = path.join(process.cwd(), 'lib/session.ts');
  expect(fs.existsSync(p)).toBe(true);
});
