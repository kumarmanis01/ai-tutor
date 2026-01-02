import fs from 'fs';
import path from 'path';

test('file exists: app/api/rooms/[roomId]/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/rooms/[roomId]/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
