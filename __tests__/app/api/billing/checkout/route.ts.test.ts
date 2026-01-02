import fs from 'fs';
import path from 'path';

test('file exists: app/api/billing/checkout/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/billing/checkout/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
