import fs from 'fs';
import path from 'path';

test('file exists: app/api/rooms/[roomId]/quiz/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/rooms/[roomId]/quiz/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
