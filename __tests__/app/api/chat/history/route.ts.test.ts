import fs from 'fs';
import path from 'path';

test('file exists: app/api/chat/history/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/chat/history/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
