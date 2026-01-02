import fs from 'fs';
import path from 'path';

test('file exists: app/api/hierarchy/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/hierarchy/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
