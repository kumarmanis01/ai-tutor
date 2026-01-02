import fs from 'fs';
import path from 'path';

test('file exists: app/api/upload-image/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/upload-image/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
