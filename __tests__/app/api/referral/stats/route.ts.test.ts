import fs from 'fs';
import path from 'path';

test('file exists: app/api/referral/stats/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/referral/stats/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
