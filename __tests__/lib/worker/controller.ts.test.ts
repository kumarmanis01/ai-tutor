import fs from 'fs';
import path from 'path';

test('file exists: lib/worker/controller.ts', () => {
  const p = path.join(process.cwd(), 'lib/worker/controller.ts');
  expect(fs.existsSync(p)).toBe(true);
});
