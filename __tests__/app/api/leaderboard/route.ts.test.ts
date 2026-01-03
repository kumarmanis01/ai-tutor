import fs from 'fs';
import path from 'path';

test('file exists: app/api/leaderboard/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/leaderboard/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
