import fs from 'fs';
import path from 'path';

test('file exists: app/api/billing/verify/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/billing/verify/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
