import fs from 'fs';
import path from 'path';

test('file exists: app/api/chat/reassign-subject/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/chat/reassign-subject/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
