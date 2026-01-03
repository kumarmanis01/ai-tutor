import fs from 'fs';
import path from 'path';

test('file exists: app/api/chat/conversations/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/chat/conversations/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
