import fs from 'fs';
import path from 'path';

test('file exists: app/api/s3-presign/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/s3-presign/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
