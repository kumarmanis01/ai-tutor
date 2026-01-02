import fs from 'fs';
import path from 'path';

test('file exists: types/rooms.ts', () => {
  const p = path.join(process.cwd(), 'types/rooms.ts');
  expect(fs.existsSync(p)).toBe(true);
});
