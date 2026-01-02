import fs from 'fs';
import path from 'path';

test('file exists: worker/bootstrap.ts', () => {
  const p = path.join(process.cwd(), 'worker/bootstrap.ts');
  expect(fs.existsSync(p)).toBe(true);
});
