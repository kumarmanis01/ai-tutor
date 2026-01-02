import fs from 'fs';
import path from 'path';

test('file exists: app/api/analytics/track/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/analytics/track/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
