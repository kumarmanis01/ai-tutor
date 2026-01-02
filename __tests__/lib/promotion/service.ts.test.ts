import fs from 'fs';
import path from 'path';

test('file exists: lib/promotion/service.ts', () => {
  const p = path.join(process.cwd(), 'lib/promotion/service.ts');
  expect(fs.existsSync(p)).toBe(true);
});
