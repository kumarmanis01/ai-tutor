import fs from 'fs';
import path from 'path';

test('file exists: app/api/chapters/[id]/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/chapters/[id]/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
