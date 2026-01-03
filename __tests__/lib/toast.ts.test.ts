import fs from 'fs';
import path from 'path';

test('file exists: lib/toast.ts', () => {
  const p = path.join(process.cwd(), 'lib/toast.ts');
  expect(fs.existsSync(p)).toBe(true);
});
