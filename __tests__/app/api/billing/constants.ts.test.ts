import fs from 'fs';
import path from 'path';

test('file exists: app/api/billing/constants.ts', () => {
  const p = path.join(process.cwd(), 'app/api/billing/constants.ts');
  expect(fs.existsSync(p)).toBe(true);
});
