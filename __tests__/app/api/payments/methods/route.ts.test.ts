import fs from 'fs';
import path from 'path';

test('file exists: app/api/payments/methods/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/payments/methods/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
