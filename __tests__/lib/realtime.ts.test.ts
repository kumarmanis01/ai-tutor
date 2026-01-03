import fs from 'fs';
import path from 'path';

test('file exists: lib/realtime.ts', () => {
  const p = path.join(process.cwd(), 'lib/realtime.ts');
  expect(fs.existsSync(p)).toBe(true);
});
