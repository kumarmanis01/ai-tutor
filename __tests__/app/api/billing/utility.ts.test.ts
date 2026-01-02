import fs from 'fs';
import path from 'path';

test('file exists: app/api/billing/utility.ts', () => {
  const p = path.join(process.cwd(), 'app/api/billing/utility.ts');
  expect(fs.existsSync(p)).toBe(true);
});
