import fs from 'fs';
import path from 'path';

test('file exists: app/api/learning-sessions/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/learning-sessions/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
