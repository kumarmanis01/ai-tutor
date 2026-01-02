import fs from 'fs';
import path from 'path';

test('file exists: app/api/save-chats/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/save-chats/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
