import fs from 'fs';
import path from 'path';

test('file exists: app/api/payments/checkout/session/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/payments/checkout/session/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
