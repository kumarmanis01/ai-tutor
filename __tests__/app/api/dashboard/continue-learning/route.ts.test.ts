import fs from 'fs';
import path from 'path';

test('file exists: app/api/dashboard/continue-learning/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/dashboard/continue-learning/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
