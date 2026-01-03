import fs from 'fs';
import path from 'path';

test('file exists: lib/payments.ts', () => {
  const p = path.join(process.cwd(), 'lib/payments.ts');
  expect(fs.existsSync(p)).toBe(true);
});
